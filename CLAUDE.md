
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CLI tool for calculating and exporting student grades at German vocational schools (Berufsschule). Calculates weighted averages for BBU (Berufsbezogener Unterricht) and general subjects based on lesson hours per semester.

## Commands

```bash
# Run the TUI application
bun run src/main.ts

# Run tests
bun test

# Run specific test file
bun test src/core/grades.test.ts
```

## Architecture

**Entry Point:** `src/main.ts` → delegates to `src/tui/app.ts`

**Core Module** (`src/core/grades.ts`):
- Grade calculation with hours-based weighting
- BBU calculates weighted average across Lernfelder
- General subjects weighted by semester hours
- `calculateSchuelerNoten()` is the main entry for grade computation

**Import Pipeline:**
- `BerufeLoader` loads Beruf→Lernfelder→Stunden mapping from Excel
- `lusd-parser.ts` parses LUSD export files (Zeugnis + Historie)
- Auto-downloads `data/BS_Schulformen_Berufe_Lernfelder.xlsx` if missing

**TUI** (`src/tui/`):
- Uses `@clack/prompts` for interactive CLI
- Screens: einzelfall (individual calculation), einstellungen (settings)
- `beruf-search.ts` provides fuzzy Beruf search with typeahead

**PDF Export** (`src/export/pdf.ts`):
- Uses `pdfkit` for PDF generation
- Renders BBU and general subjects tables with grades

**Types** (`src/types/index.ts`):
- `Schueler`, `Beruf`, `Berechnungsergebnis` defined here
- Constants: `LERNFELDER` (LF01-LF18), `ALLGEMEINE_FAECHER` (D, POWI, RKA, SPO, ENG)

## Key Data Files

- `data/BS_Schulformen_Berufe_Lernfelder.xlsx` - Beruf definitions with hours per Lernfeld (auto-downloaded)
- `data/einstellungen.json` - User settings (hours per semester - created on first run)
- `output/` - Generated PDFs

## Configuration

Semester hours defined in `src/config/einstellungen.ts`:
- Default: 10/2: 40h, 11/1-13/1: each 20h
- User can customize via TUI settings screen
