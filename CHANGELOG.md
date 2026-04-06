# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/)
Versionierung: [SemVer](https://semver.org/lang/de/).

## [Unreleased]

### Hinzugefügt
- `shared/constants.ts` als zentrale Quelle für `LERNFELDER`, `ALLGEMEINE_FAECHER`,
  `ALLE_HALBJAHRE`, `HALBJAHR_MAP`, `STUNDEN_GRENZEN`, `FACH_LABELS`,
  `DEFAULT_FACH_STUNDEN`.
- `bun run dev` startet den Web-Server mit HMR (`bun --hot main.ts`).
- Biome 2.4.10 als Linter+Formatter (`bun run lint`, `bun run format`).
- GitHub Actions Workflow `test.yml`: führt `bun test`, `tsc --noEmit` und
  `biome check` bei jedem Push/PR aus.
- Pre-Commit-Hook unter `.githooks/pre-commit` (aktivieren mit
  `git config core.hooksPath .githooks`).

### Geändert
- DOM/DOM.Iterable in der Root-`tsconfig.json` ergänzt (Web-Code braucht
  keine eigene tsconfig mehr).
- Komponenten ohne `import React` (React 19 JSX-Runtime).
- Konstanten und Helper aus `core/grades.ts`, `web/lib/constants.ts`,
  `web/hooks/useSchueler.ts`, `types/index.ts` und `config/einstellungen.ts`
  zentralisiert (re-exportieren jetzt aus `shared/`).

### Entfernt
- Tote `HALBJAHRE_STUNDEN`-Konstante aus `core/grades.ts`.
- TUI aus `tsconfig`-Check und Biome-Scope (Code bleibt im Repo, wird aber
  nicht weiterentwickelt — siehe `plan.md` Abschnitt "TUI").

## [0.6.0] – 2026-04

### Hinzugefügt
- Web-UI Migration: React-Frontend mit `Bun.serve()`, per-Fach-Stunden,
  Templates, Drafts, Theme-Toggle.
- Vollbild-Intro, editierbare Stunden pro Halbjahr.
- Korrekte Noten-Skala (1.0–6.0 statt 1.0–5.0) und LF-Kappung nach
  Stundengrenzen pro Ausbildungsjahr.
- GitHub Actions Release-Workflow für automatische Builds bei Tag-Push.

### Behoben
- Windows-Executable schließt sich sofort: `ROOT_DIR`-Auflösung +
  Crash-Handler.

## [0.5.0 und früher]

Siehe `git log` für Details — TUI-Phase mit `@clack/prompts`, Excel-Import,
PDF-Export, Beruf-Suche, Klassenberechnung-Skizze.
