
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLI tool for calculating and exporting student grades at German vocational schools (Berufsschule). Calculates weighted averages for BBU (Berufsbezogener Unterricht) and general subjects based on lesson hours per semester.

## Commands

```bash
# All commands run from Skript/ directory
cd Skript/

# Run the TUI application
bun run start

# Run tests
bun test

# Run specific test file
bun test core/grades.test.ts

# Build standalone executables (Linux, macOS, Windows)
bun run build
```

## Architecture

**Entry Point:** `Skript/main.ts` → delegates to `Skript/tui/app.ts`

**Core Module** (`Skript/core/grades.ts`):
- Grade calculation with hours-based weighting
- BBU calculates weighted average across Lernfelder
- General subjects weighted by semester hours
- `calculateSchuelerNoten()` is the main entry for grade computation

**Import Pipeline:**
- `BerufeLoader` loads Beruf→Lernfelder→Stunden mapping from Excel
- `lusd-parser.ts` parses LUSD export files (Zeugnis + Historie)
- Auto-downloads `Input/BS_Schulformen_Berufe_Lernfelder.xlsx` if missing

**TUI** (`Skript/tui/`):
- Uses `@clack/prompts` for interactive CLI
- Screens: einzelfall (individual calculation), tutorial, einstellungen (settings)
- `beruf-search.ts` provides fuzzy Beruf search with typeahead
- `tips.ts` provides contextual tutorial tips per step

**PDF Export** (`Skript/export/pdf.ts`):
- Uses `pdfkit` for PDF generation
- Logos embedded as Base64 in `Skript/assets/logos.ts` (for standalone binary support)
- Renders BBU and general subjects tables with grades

**Types** (`Skript/types/index.ts`):
- `Schueler`, `Beruf`, `Berechnungsergebnis` defined here
- Constants: `LERNFELDER` (LF01-LF18), `ALLGEMEINE_FAECHER` (D, POWI, RKA, SPO, ENG)

## Key Data Files

- `Input/BS_Schulformen_Berufe_Lernfelder.xlsx` - Beruf definitions with hours per Lernfeld (auto-downloaded)
- `Input/einstellungen.json` - User settings (hours per semester, tutorial tips - created on first run)
- `Output/` - Generated PDFs

## Configuration

Semester hours defined in `Skript/config/einstellungen.ts`:
- Default: 10/2: 40h, 11/1-13/1: each 20h
- `tutorialTipps: true` — contextual tips during Einzelfall workflow
- User can customize via TUI settings screen

## Folder Structure

- `Skript/` — All source code, package.json, node_modules, tsconfig.json, build.ts
- `Input/` — User data files (Excel, settings JSON)
- `Output/` — Generated PDF files
- Root contains only: `Skript/`, `Input/`, `Output/`, executables (after build), README, CLAUDE.md, .gitignore
