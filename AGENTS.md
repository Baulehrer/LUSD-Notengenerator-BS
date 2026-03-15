# AGENTS.md - LUSD Notengenerator

Agent instructions for this codebase.

## Project Overview

LUSD Notengenerator is a CLI tool for calculating and exporting student grades from German vocational schools. It imports data from LUSD Excel exports, calculates weighted grades, and generates PDF reports.

## Runtime

**Use Bun instead of Node.js:**
- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of `jest` or `vitest`
- `bun install` instead of `npm install`
- `bunx <package>` instead of `npx <package>`
- Bun automatically loads `.env` - no dotenv needed

## Commands

```bash
# Install dependencies
bun install

# Run the application
bun run src/main.ts

# Run tests (bun:test framework)
bun test

# Run a single test file
bun test src/core/grades.test.ts

# Run tests matching a pattern
bun test -t "calculateBBUNote"

# Type check
bunx tsc --noEmit

# Lint and format (if biome.json exists)
bunx @biomejs/biome check --write .
```

## Project Structure

```
├── src/
│   ├── main.ts           # Entry point
│   ├── core/
│   │   └── grades.ts     # Grade calculation logic
│   ├── import/
│   │   ├── berufe-loader.ts  # Load Beruf data from Excel
│   │   └── lusd-parser.ts    # Parse LUSD export files
│   ├── export/
│   │   └── pdf.ts        # PDF generation
│   ├── tui/
│   │   ├── app.ts        # Main TUI loop
│   │   └── screens/      # Individual screens
│   └── types/
│       └── index.ts      # Shared type definitions
├── data/                 # Excel data files
└── output/               # Generated PDFs
```

## Code Style

### Imports

```typescript
// Namespace imports for libraries with many exports
import * as p from '@clack/prompts'
import * as XLSX from 'xlsx'
import * as fs from 'node:fs'
import * as path from 'node:path'

// Type-only imports - always use `type` keyword
import type { Schueler, Berechnungsergebnis } from '../types'
import type { BerufeLoader } from '../import/berufe-loader'

// Regular imports
import { calculateSchuelerNoten } from '../core/grades'
```

### Naming Conventions

- **Functions:** camelCase (`calculateBBUNote`, `parseNote`)
- **Variables:** camelCase (`totalGewichtung`, `stunden`)
- **Types/Interfaces:** PascalCase (`Schueler`, `Berechnungsergebnis`, `NoteEintrag`)
- **Constants:** SCREAMING_SNAKE_CASE for true constants (`LERNFELDER`, `ALLGEMEINE_FAECHER`)
- **Private fields:** camelCase with `private` modifier (no underscore prefix)

### Types

- Prefer `Map<K, V>` over `Record<string, V>` for keyed collections
- Use `readonly` arrays for constants: `as const`
- Use union types for literals: `1 | 2` for halbjahr
- Prefer `null` over `undefined` for optional values in domain types
- Use `type` for imports of types: `import type { ... }`
- Use `interface` for object types, `type` for unions/aliases

```typescript
// Good
export interface NoteEintrag {
  note: number | null
  lehrer: string
}

export const LERNFELDER = ['LF01', 'LF02'] as const
export type LernfeldId = typeof LERNFELDER[number]

// Prefer Map for keyed collections
export interface Beruf {
  name: string
  lernfelder: Map<string, number>
}
```

### Formatting

- No semicolons (TypeScript/Bun convention)
- 2-space indentation
- Single quotes for strings (double quotes only when needed)
- Template literals for string interpolation

### Error Handling

- Throw `Error` with descriptive German messages for user-facing errors
- Return `null` for optional/not-found values
- Use early returns to avoid deep nesting

```typescript
// Good
if (!sheet) {
  throw new Error('Sheet "Berufe mit Lernfeldern" nicht gefunden')
}

// Good - return undefined for not found
getBeruf(name: string): Beruf | undefined {
  // ...
}
```

### Private Fields

- Use camelCase with `private` modifier (no underscore prefix)

```typescript
export class BerufeLoader {
  private berufe: Map<string, Beruf> = new Map()

  private async downloadFile(url: string, destPath: string): Promise<void> {
    // ...
  }
}
```

### Async/Await

- Always use `async/await` over `.then()` chains
- Use `Promise<T>` wrapper for callback-based APIs

```typescript
export async function generatePDF(ergebnisse: Berechnungsergebnis[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // callback-based PDFKit code
  })
}
```

## Domain Knowledge

- **BBU (Berufsbezogener Bereich):** Vocational subjects with hours-weighted grades
- **Lernfelder (LF01-LF18):** Learning fields with specific hour allocations per Beruf
- **Allgemeine Faecher:** General subjects (D, POWI, RKA, SPO, ENG)
- **Grade calculation:** Weighted average based on hours per subject/halbjahr
- **Halbjahre:** School half-years (10/1, 10/2, 11/1, etc.)

## Language Convention

- **Code:** German (variable names, function names, comments)
- **UI/Strings:** German (user-facing messages, prompts)
- **File names:** German (kebab-case)

## Testing

When writing tests:

```typescript
import { test, expect, describe } from 'bun:test'
import { roundNote, parseNote, calculateBBUNote } from './grades'

describe('roundNote', () => {
  test('rounds to 1 decimal place', () => {
    expect(roundNote(2.345)).toBe(2.3)
    expect(roundNote(2.356)).toBe(2.4)
  })
})
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@clack/prompts` | Interactive CLI prompts |
| `pdfkit` | PDF generation |
| `xlsx` | Excel file parsing |
| `@types/bun` | TypeScript types for Bun |
| `@types/pdfkit` | TypeScript types for pdfkit |

## Key Files to Read First

1. `src/types/index.ts` - Domain types
2. `src/core/grades.ts` - Core calculation logic
3. `src/tui/app.ts` - Application flow

## Test Coverage

The project has comprehensive unit tests using `bun:test`:

| Module | Tests | File |
|--------|-------|------|
| Grade calculations | 23 | `src/core/grades.test.ts` |
| Berufe loader | 16 | `src/import/berufe-loader.test.ts` |
| LUSD parser | 13 | `src/import/lusd-parser.test.ts` |

Run all tests: `bun test` (52 tests, ~1s)

## Security

- Never introduce OWASP Top 10 vulnerabilities
- Validate all user inputs and external data
- No secrets in code or commits
