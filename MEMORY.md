# MEMORY.md - LUSD Notengenerator

## Projekt-Status (Stand 2026-03-13)

### Erledigt
- ✅ Projektstruktur analysiert und dokumentiert
- ✅ AGENTS.md erstellt (Code-Style, Commands, Conventions)
- ✅ Git initialisiert (main branch)
- ✅ Test-Suite aufgebaut: **52 Tests** (3 Test-Dateien)
  - `src/core/grades.test.ts` - 23 Tests (roundNote, parseNote, calculateBBUNote, etc.)
  - `src/import/berufe-loader.test.ts` - 16 Tests (load, getBeruf, searchBerufe)
  - `src/import/lusd-parser.test.ts` - 13 Tests (parseZeugnisFile, parseHistorieFile, combine)
- ✅ Type-Check ohne Fehler (`bunx tsc --noEmit`)
- ✅ Alle Tests grün (`bun test`)
- ✅ .gitignore um Vorlage/ erweitert

### Test-Abdeckung

| Modul | Funktionen | Tests |
|-------|------------|-------|
| `roundNote` | Noten auf 1 Dezimalstelle runden | 3 |
| `roundToWholeNote` | Noten auf ganze Zahl runden | 3 |
| `parseNote` | P-X Format parsen | 3 |
| `calculateBBUNote` | Gewichtsnoten BBU | 4 |
| `calculateAllgemeinesFach` | Allg. Fächer | 4 |
| `calculateGesamtnote` | Gesamtnote | 3 |
| `calculateSchuelerNoten` | Komplette Berechnung | 3 |
| `BerufeLoader` | Excel laden/suchen | 16 |
| `lusd-parser` | LUSD Exporte parsen | 13 |

### Offene Punkte
- [ ] PDF-Export Tests (`src/export/pdf.ts`)
- [ ] TUI Screen Tests
- [ ] Klassenberechnung mit echten LUSD-Daten testen

### Befehle
```bash
bun run src/main.ts    # App starten
bun test               # Alle Tests
bun test -t "pattern"  # Tests filtern
bunx tsc --noEmit      # Type-Check
```

### Git
- Branch: `main`
- Initial Commit: `b30d169` - "Initial commit: LUSD Notengenerator with test coverage"
- Nicht getrackt: `data/`, `Vorlage/`, `index.ts`
