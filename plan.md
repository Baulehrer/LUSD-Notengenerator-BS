# Plan: Projekt-Optimierung LUSD Notengenerator

## Context

Die Web-UI-Migration ist abgeschlossen (v0.6.0+, 57 Tests grün, Web-Server läuft, Excel-Vorlage validiert). Das Projekt funktioniert, zeigt aber an mehreren Stellen Drift und Aufräumbedarf, der jetzt konsolidiert abgearbeitet werden soll, bevor neue Features dazukommen.

**Ziele dieser Optimierungsrunde:**
- Duplizierte Konstanten und toten Code entfernen (Risiko: Drift bei Änderungen)
- Developer Experience verbessern (HMR-Dev-Script, Linting, CI-Tests, Pre-Commit)
- Spürbare UX-Verbesserungen im Web (Autosave, Undo, Shortcuts, Unsaved-Warning)
- Berechnung vom Server ins Frontend verlagern (reagiert sofort, offline-fähig)
- Test-Coverage auf Server/API und PDF-Export ausweiten
- TUI als Feature bewusst offenhalten (Code bleibt, wird aber nicht weiterentwickelt)

**Nicht in diesem Plan:**
- TUI-Reaktivierung/Hybridmodus (bleibt bewusst liegen, siehe Abschnitt „TUI")
- Neue Features (Klassenberechnung, JSON/CSV-Export, Schema-Validator)

---

## Scope & Reihenfolge

Die Umsetzung erfolgt in 6 Phasen, in der angegebenen Reihenfolge. Jede Phase ist in sich abgeschlossen und testbar — zwischen den Phasen wird jeweils `bun test` + Server-Smoke-Test ausgeführt.

| Phase | Thema | Abh. |
|---|---|---|
| 1 | Foundation: Konstanten zentralisieren, tsconfig, Dead Code | — |
| 2 | DevEx: `dev`-Script, Biome, CI-Tests, Pre-Commit-Hook, CHANGELOG | 1 |
| 3 | Architektur: Client-side Berechnung (`core/grades.ts` ins Frontend) | 1 |
| 4 | UX: Autosave, Undo, Shortcuts, Unsaved-Warning, Version aus package.json, Stunden im Tabellenkopf | 1, 3 |
| 5 | Tests: Server/API, PDF-Smoke, zentrale Hook-Tests | 1, 3 |
| 6 | `einzelfall.ts` refactoren (1152 → ~5 Dateien) | — (TUI-isoliert) |

---

## Phase 1 — Foundation

**Ziel:** Einmalige Quelle der Wahrheit für Konstanten, korrekte TS-Typen, kein toter Code.

### 1.1 `shared/constants.ts` (neu, top-level unter `Skript/`)
- Konstanten aus `core/grades.ts`, `web/lib/constants.ts`, `web/hooks/useSchueler.ts`, `tui/screens/einzelfall.ts`, `tui/screens/einstellungen.ts`, `types/index.ts`, `import/lusd-parser.ts` zentralisieren:
  - `LERNFELDER` (LF01–LF18)
  - `ALLGEMEINE_FAECHER` (`['D','POWI','RKA','SPO','ENG']`)
  - `FACH_LABELS` (`{ D: 'Deutsch', ... }`)
  - `ALLE_HALBJAHRE` (`['10/2','11/1','11/2','12/1','12/2','13/1']`)
  - `AUSBILDUNGSJAHRE` (aus `web/lib/constants.ts`)
  - `HALBJAHR_MAP` (aus `useSchueler.ts` — 1.AJ=10/2 doppelt, 2.AJ=11/1+11/2, 3.AJ=12/1+12/2)
  - `STUNDEN_GRENZEN` (cumulative 320/320/600/600/880/880)
  - `fachStunden(std: number): Record<string, number>` Helfer
- `web/lib/constants.ts` re-exportiert aus `shared/constants.ts` (Backwards-compat für bestehende Web-Imports)
- Alle anderen Konsumenten (`core/grades.ts`, `useSchueler.ts`, `app.tsx`, `server.ts`, TUI-Dateien) importieren aus `shared/`

### 1.2 tsconfig für Web-Code
- Neues `Skript/web/tsconfig.json` mit `"extends": "../tsconfig.json"` und `"compilerOptions": { "lib": ["ESNext", "DOM", "DOM.Iterable"] }`
- Root-`tsconfig.json` bekommt `references: [{ path: "./web" }]` oder alternativ: das bestehende Root-tsconfig wird um DOM ergänzt (Web überwiegt — einfacherer Weg)
- **Entscheidung**: DOM in Root-tsconfig ergänzen (einfacher, TUI nutzt kein `window`/`document`)
- Verifikation: `bunx tsc --noEmit` muss 0 Fehler ausgeben

### 1.3 Dead Code entfernen
- `HALBJAHRE_STUNDEN` (flat const) in `core/grades.ts:3-11` — nur Fallback der nie erreicht wird
- `calculateAllgemeinesFach` Signatur: prüfen ob Fallback-Parameter noch gebraucht wird (wird er nicht — kommt immer per-fach)
- `web/styles/components.css`: dead Selectoren (bereits 1× passiert, Re-Check)
- `web/components/Ergebnis.tsx`, `Header.tsx`, `LernfelderGrid.tsx`, `ThemeToggle.tsx`: ungenutzte `import React` entfernen (React 19 JSX-Runtime braucht das nicht)

### 1.4 Kritische Dateien
- `Skript/shared/constants.ts` (NEU)
- `Skript/core/grades.ts` (Konstanten raus, Dead Code raus)
- `Skript/web/lib/constants.ts` (Re-Export)
- `Skript/web/hooks/useSchueler.ts` (HALBJAHR_MAP, STUNDEN_GRENZEN raus)
- `Skript/web/app.tsx`, `Skript/web/components/*.tsx` (React-Imports aufräumen)
- `Skript/tsconfig.json` (DOM-lib)
- `Skript/types/index.ts` (Konstanten raus, nur Typen bleiben)

---

## Phase 2 — DevEx & Workflow

**Ziel:** Schnellere Iteration, automatische Qualitätssicherung.

### 2.1 Dev-Script mit HMR
- `package.json` erweitern: `"dev": "bun --hot main.ts"`
- `server.ts` hat `development: { hmr: true, console: true }` bereits gesetzt — HMR greift dann automatisch

### 2.2 Biome als Linter + Formatter
- `bun add -d @biomejs/biome`
- `biome.json` mit Defaults + `"files": { "ignore": ["node_modules", "../Output", "../Input"] }`
- Scripts: `"lint": "biome check ."`, `"format": "biome format --write ."`
- **Wichtig:** Keine großen Reformats-Commits mischen — erst Config, dann ein separater „style: format all"-Commit
- Indent: Tabs oder 2-Space? → **2-Space** (entspricht aktuellem Stil)

### 2.3 GitHub Actions: Test-Workflow
- Neue Datei `.github/workflows/test.yml`:
  ```yaml
  name: Tests
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v2
        - run: cd Skript && bun install
        - run: cd Skript && bun test
        - run: cd Skript && bunx tsc --noEmit
        - run: cd Skript && bunx biome check .
  ```
- Bestehender Release-Workflow bleibt unberührt

### 2.4 Pre-Commit-Hook
- `.githooks/pre-commit` (Bash):
  ```bash
  #!/usr/bin/env bash
  cd Skript && bun test && bunx tsc --noEmit && bunx biome check .
  ```
- Einmalig: `git config core.hooksPath .githooks`
- README-Hinweis ergänzen, damit neue Checkouts das auch aktivieren
- **Nicht** via husky/lint-staged (unnötige Dependency)

### 2.5 CHANGELOG.md
- `CHANGELOG.md` im Stammverzeichnis, Format „Keep a Changelog"
- Initialer Inhalt aus `git log --oneline` ab `4eb40ec` extrahieren: v0.6.0-Eintrag, dann `[Unreleased]`-Sektion für diese Optimierungsrunde

### 2.6 Kritische Dateien
- `Skript/package.json` (scripts)
- `Skript/biome.json` (NEU)
- `.github/workflows/test.yml` (NEU)
- `.githooks/pre-commit` (NEU)
- `CHANGELOG.md` (NEU, Root)

---

## Phase 3 — Client-side Berechnung

**Ziel:** `calculateSchuelerNoten` läuft im Browser statt auf dem Server. Sofortige Reaktion, keine 150 ms Debounce-Round-Trip, funktioniert offline.

### 3.1 Prüfung: Ist `core/grades.ts` browser-tauglich?
- Aktuell: reine TypeScript-Logik, importiert nur `types/index.ts`. Keine Node-/Bun-APIs. ✅ direkt ins Frontend bundlebar.

### 3.2 Integration
- `useSchueler.ts` ruft statt `calculate(...)` (API-Call) direkt `calculateSchuelerNoten(...)` aus `core/grades.ts`
- Der `useRef<setTimeout>`-Debounce entfällt — Berechnung ist synchron und schnell genug (<1 ms)
- Die Konvertierung zwischen `{ lernfelderNoten: Record<string, number|null> }` (Frontend) und `Map<string, NoteEintrag[]>` (Core) passiert jetzt client-seitig — Helper `buildSchuelerFromState(...)` in `useSchueler.ts`
- `POST /api/calculate` aus `server.ts` entfernen (nicht mehr benötigt) — zusammen mit `calculate()` in `web/lib/api.ts`

### 3.3 PDF-Export bleibt Server-seitig
- `POST /api/pdf` bekommt weiterhin das Body-Objekt, `server.ts` ruft `calculateSchuelerNoten` + `generatePDF`. Doppelte Berechnung ist akzeptabel (einmalige Operation).

### 3.4 Kritische Dateien
- `Skript/web/hooks/useSchueler.ts` (Kern-Änderung)
- `Skript/web/lib/api.ts` (`calculate` entfernen)
- `Skript/server.ts` (`/api/calculate`-Route entfernen)

### 3.5 Verifikation
- Manuell: Note eintippen → Ergebnis ändert sich ohne wahrnehmbaren Lag
- `bun test`: keine Regressionen in `core/grades.test.ts`
- DevTools Network-Tab: bei Notenänderung keine Requests mehr

---

## Phase 4 — UX-Verbesserungen im Web

### 4.1 Autosave (localStorage)
- Neuer Hook `web/hooks/useAutosave.ts`
- Speichert den kompletten `getRequestBody()`-State als JSON in `localStorage['lusd-draft']`, debounced 500 ms
- Beim Start von `App`: wenn Draft existiert → Modal „Nicht gespeicherte Eingaben vom {timestamp} wiederherstellen?" mit „Laden" / „Verwerfen"
- Explizites Speichern („Reset"-Button) löscht den Draft
- Nach erfolgreicher PDF-Erstellung: Draft markieren als „exportiert" (nicht löschen, aber Hinweis beim nächsten Start)

### 4.2 Unsaved-Warning (`beforeunload`)
- In `useAutosave`: wenn State von Initial abweicht und noch kein PDF erzeugt wurde → `window.onbeforeunload = () => 'Ungespeicherte Eingaben gehen verloren.'`
- Cleanup bei PDF-Erstellung / Reset

### 4.3 Undo-Stack
- Neuer Hook `web/hooks/useUndo.ts`
- Speichert die letzten 20 Notenänderungen (Lernfelder + Allg. Fächer)
- Shortcut Ctrl+Z / Cmd+Z
- Visuelles Feedback: kurzer Toast „Rückgängig: LF03 4 → 3"
- Kein Redo (YAGNI)

### 4.4 Keyboard-Shortcuts
Zentral in `app.tsx` via `useEffect` + `keydown`-Listener:
- `Ctrl+P` → `handlePdf()` (preventDefault gegen Browser-Druckdialog)
- `Ctrl+S` → explizites „Speichern"-Feedback (Draft ist schon da, aber UX-Signal)
- `Ctrl+Z` → Undo
- `Esc` → offenes Modal schließen (falls nicht schon vorhanden)

### 4.5 Version aus package.json
- `server.ts` oder `app.tsx`: `import pkg from '../package.json' with { type: 'json' }`
- `Header.tsx` bekommt `version`-Prop und zeigt `v{version}`
- Entfernt das hardcoded `v0.6.0`

### 4.6 Stunden im Tabellenkopf der Allg. Fächer
- `AllgFaecher.tsx`: unter jedem HJ-Header die Stunden pro Fach anzeigen, kleine sekundäre Schrift
- Alternative: Tooltip beim Hover (weniger Lärm)
- **Entscheidung**: sekundäre Schrift unter Fachname (links) zeigen, nicht pro HJ — zeigt das gewichtete Standard-Profil

### 4.7 Kritische Dateien
- `Skript/web/hooks/useAutosave.ts` (NEU)
- `Skript/web/hooks/useUndo.ts` (NEU)
- `Skript/web/app.tsx` (Shortcuts, Autosave-Integration, Version)
- `Skript/web/components/Header.tsx` (Version-Prop)
- `Skript/web/components/AllgFaecher.tsx` (Stunden-Anzeige)
- `Skript/web/components/Einstellungen.tsx` (`onReset` löscht Draft)

---

## Phase 5 — Test-Coverage

### 5.1 Server/API-Tests
- Neue Datei `Skript/server.test.ts`
- Nutzt `server.fetch(new Request(...))` direkt (ohne Port-Allokation) — `Bun.serve` unterstützt das
- Abzudeckende Routen:
  - `GET /api/berufe?q=Kfz` → Array mit Treffern
  - `GET /api/beruf/:name` → Beruf-Objekt, 404 bei unbekanntem Namen
  - `POST /api/pdf` mit Minimaldaten → Status 200, Content-Type `application/pdf`, Body > 1 KB
  - `GET /api/einstellungen` → Default-Struktur
  - `PUT /api/einstellungen` mit partiellem Patch → merged, andere Felder bleiben
  - `GET/POST/DELETE /api/templates` → CRUD-Roundtrip
- Temporäres `INPUT_DIR`/`OUTPUT_DIR` via Env-Var oder Mock (damit Tests nicht echte Dateien anfassen)

### 5.2 PDF-Smoke-Test
- Teil von `server.test.ts` oder separat `export/pdf.test.ts`
- Erzeugt PDF mit Beispiel-Schüler, prüft:
  - Buffer.length > 1024
  - Erste 4 Bytes == `%PDF`
  - (optional) Enthält Nachname als Text — via `pdf-parse` nur wenn simpel; sonst skip
- Ziel: erkennt kaputten PDF-Export vor Release

### 5.3 Hook-Tests (optional, wenn Zeit)
- `web/hooks/useSchueler.test.ts` mit `bun test` + `happy-dom`
- `bun add -d happy-dom @testing-library/react` (letzteres optional)
- Deckt: `loadFromVorlage`, `getRelevanteLernfelder` Cut-off, `reset`
- **Entscheidung**: Nur wenn Phase 1–4 sauber durch sind. Frontend-Tests sind anfällig für Brittleness; Core ist wichtiger.

### 5.4 Kritische Dateien
- `Skript/server.test.ts` (NEU)
- `Skript/export/pdf.test.ts` (NEU, klein)
- `Skript/web/hooks/useSchueler.test.ts` (NEU, optional)

---

## Phase 6 — `einzelfall.ts` Refactor (TUI)

**Achtung:** Die TUI wird nicht weiterentwickelt (siehe unten), aber der Code bleibt. Der Refactor ist dennoch sinnvoll, damit eine zukünftige Reaktivierung leichter fällt und `einzelfall.ts` nicht als 1152-Zeilen-Monolith in Reviews/Greps auftaucht.

**Dieser Schritt ist optional und kann nach Phase 1–5 auch weggelassen werden.**

### 6.1 Aufteilung
`Skript/tui/screens/einzelfall/` (Ordner, ersetzt Einzeldatei):
- `index.ts` — `einzelfallBerechnung()` Einstiegspunkt (schlank)
- `state.ts` — `SessionState`, `UndoStack`, `buildSchueler()`
- `steps.ts` — alle `step*`-Funktionen (`stepPersoenlich`, `stepLernfelder`, `stepAllgFaecher`, `stepPreview`, `stepErgebnis`)
- `handlers.ts` — `editStunden`, `editNote`, `handlePDFExport`
- `draft.ts` — Draft-Loading/-Saving

### 6.2 Gleichzeitig: Per-Fach-Kompatibilität wiederherstellen
- Die TUI castet aktuell `halbjahrStunden as Record<string, number>` — das ist nach der per-Fach-Umstellung falsch
- Im Refactor: einen Helfer `flattenHalbjahrStunden(perFach): Record<string, number>` einführen, der pro HJ den Deutsch-Wert (oder Durchschnitt) nimmt
- Oder: TUI direkt auf `Record<string, Record<string, number>>` umstellen (konsistent mit Core)
- **Entscheidung**: Konsistent umstellen — weniger magisch. TUI-Einstellungs-Screen wird als Matrix-View oder HJ-weiser Durchschnittsmodus neu skizziert, aber nicht implementiert (nur Compile-Fehler beheben, Stub belassen).

### 6.3 Kritische Dateien
- `Skript/tui/screens/einzelfall.ts` → gelöscht
- `Skript/tui/screens/einzelfall/*` (NEU, 5 Dateien)
- `Skript/tui/screens/einstellungen.ts` (per-Fach-fix oder als Stub markieren)

---

## TUI — bewusste Entscheidung

**Status:** TUI-Code (`Skript/tui/`) bleibt im Repo erhalten. `@clack/prompts` bleibt Dependency. Keine Weiterentwicklung, kein Hybrid-Launcher, kein Dispatcher in `main.ts`.

**Bedeutung:** `bun run start` bzw. `bun main.ts` startet weiterhin ausschließlich den Web-Server. Die TUI ist aktuell nicht erreichbar.

**Offenhalten für später:** Sollte der Hybridmodus reaktiviert werden, sind folgende Schritte nötig (dokumentiert in CHANGELOG-Sektion „Deferred"):
1. Dispatcher in `main.ts`: `--tui`-Flag → `tui/app.ts`, sonst Web
2. TUI-Einstellungs-Screen auf per-Fach umstellen (Phase 6.2)
3. TUI-Einzelfall auf per-Fach umstellen (Phase 6.2)
4. Separater `package.json`-Script `"tui": "bun main.ts --tui"`

Diese Punkte sind **nicht Teil dieses Plans**, werden aber in der README als „verfügbare Option" erwähnt.

---

## Gesamter Ablauf & Commits

Jede Phase = 1 oder mehrere zusammenhängende Commits. Zwischen Phasen: `bun test` + `tsc --noEmit` + `biome check .` + manueller Server-Smoke-Test.

1. `refactor: zentrale Konstanten in shared/, tsconfig DOM-lib, Dead Code` (Phase 1)
2. `chore: dev-Script, Biome-Config, CI-Test-Workflow, Pre-Commit-Hook, CHANGELOG` (Phase 2)
3. `style: format all` (Phase 2, separater Commit nach Biome-Setup)
4. `refactor: Client-side Berechnung — /api/calculate entfällt` (Phase 3)
5. `feat: Autosave, Undo, Keyboard-Shortcuts, Unsaved-Warning, Version aus package.json, Stunden im Tabellenkopf` (Phase 4) — evtl. aufgeteilt in 2–3 Commits
6. `test: Server/API + PDF-Smoke-Tests` (Phase 5)
7. `refactor: tui/einzelfall.ts in Module aufgeteilt` (Phase 6, optional)

---

## Verifikation (End-to-End)

Nach Abschluss aller Phasen:

1. **Compile & Lint**: `bunx tsc --noEmit` (0 Fehler), `bunx biome check .` (0 Fehler)
2. **Tests**: `bun test` — alle bestehenden 57 + neue Server/PDF-Tests grün
3. **DevEx**: `bun run dev` startet HMR-Server, Änderung an `app.tsx` triggert Hot-Reload ohne Full-Reload
4. **CI**: Push auf Branch → Actions-Workflow läuft durch
5. **Pre-Commit**: `git commit` mit absichtlichem Fehler → blockt
6. **Web-UI Manual**:
   - Noteneingabe: Ergebnis ändert sich sofort (kein Debounce spürbar), Network-Tab zeigt keine `/api/calculate`-Requests
   - Ctrl+Z: letzte Notenänderung wird rückgängig
   - Ctrl+P: PDF-Download startet
   - Reload-Test: Noten eingeben, F5, Modal „Entwurf wiederherstellen?" erscheint
   - Beruf wechseln bei ungespeicherten Änderungen: `beforeunload`-Warnung
   - PDF-Generierung: Datei im Format `Name_Vorname_Klasse_Datum.pdf`, öffnet korrekt, BBU/Gesamtnote stimmen
   - Version im Header: zeigt `v0.6.x` aus package.json
   - Allg-Fächer-Tabelle: Stunden pro Fach sichtbar
7. **Excel-Vorlage-Validierung**: wie im vorigen Durchlauf — Kfz-Mechatroniker Beispiel, Werte müssen exakt matchen
8. **TUI-Check**: `tui/`-Code existiert, `@clack/prompts` in package.json, `bun main.ts` startet Web

---

## Aufwand (grobe Schätzung)

| Phase | Aufwand |
|---|---|
| 1 Foundation | 1–1,5 h |
| 2 DevEx | 1 h |
| 3 Client-side Berechnung | 1–1,5 h |
| 4 UX | 2–3 h |
| 5 Tests | 1,5–2 h |
| 6 TUI-Refactor (optional) | 2–3 h |

**Gesamt ohne Phase 6:** ca. 6–9 h reiner Implementierungszeit, in mehrere Sessions teilbar.

---

## Erste Aktion nach ExitPlanMode

**Diesen Plan als `plan.md` ins Stammverzeichnis (`/home/kaufmann/Stephans Projekte/Skripte/LUSD Notengenerator/plan.md`) schreiben** — identischer Inhalt wie diese Datei, damit der Plan im Projekt selbst liegt und gemeinsam mit dem Code versioniert werden kann.
