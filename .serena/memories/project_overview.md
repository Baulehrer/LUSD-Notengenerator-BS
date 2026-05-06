# LUSD Notengenerator — Project Overview

## Purpose
CLI/Web tool for calculating and exporting student grades at German vocational schools (Berufsschule).
Calculates weighted averages for BBU (Berufsbezogener Unterricht) and general subjects based on lesson hours per semester.

## Tech Stack
- Runtime: Bun (not Node.js)
- Frontend: React 19 (automatic JSX runtime, no `import React` needed)
- Server: Bun.serve() with HTML imports (no Vite/Webpack)
- PDF: pdfkit
- TUI: @clack/prompts (intentionally not maintained, excluded from TS/Biome)
- Linter/Formatter: Biome 2.4.10
- Language: TypeScript (verbatimModuleSyntax: true, noUnusedLocals: true)

## Project Structure
- `Skript/` — all source code, package.json, tsconfig.json
  - `core/grades.ts` — grade calculation logic
  - `shared/constants.ts` — single source of truth for all constants
  - `types/index.ts` — TypeScript types
  - `web/` — React frontend (app.tsx, components/, hooks/, lib/, styles/)
  - `server.ts` — Bun.serve() server
  - `export/pdf.ts` — PDF generation
  - `import/` — Excel/LUSD parser
  - `config/` — settings, paths, templates
  - `tui/` — excluded from TS/Biome checks
- `Input/` — user data (Excel, settings JSON)
- `Output/` — generated PDFs
- `.github/workflows/` — CI (test.yml, release.yml)
- `.githooks/pre-commit` — pre-commit hook (activate: git config core.hooksPath .githooks)

## Key Domain Concepts
- LERNFELDER: LF01–LF18 (BBU subjects, weighted by hours)
- ALLGEMEINE_FAECHER: D, POWI, RKA, SPO, ENG
- HALBJAHRE: 10/2, 11/1, 11/2, 12/1, 12/2, 13/1
- AUSBILDUNGSJAHRE: 1.AJ=10/2, 2.AJ=11/1+11/2, 3.AJ=12/1+12/2
- BBU note = weighted average across Lernfelder (by hours)
- Allgemeine Fächer note = weighted average across Halbjahre (by hours)
- Gesamtnote = weighted average of all
