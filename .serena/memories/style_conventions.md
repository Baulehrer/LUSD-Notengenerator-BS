# Code Style & Conventions

- Biome 2.4.10: singleQuote, no semicolons, trailingCommas all, indentWidth 2, lineWidth 120
- TypeScript: verbatimModuleSyntax, noUnusedLocals — use `import type` for type-only imports
- React 19 automatic JSX runtime — no `import React` needed
- No comments unless WHY is non-obvious
- No explicit `any` in new code (biome rule off for legacy)
- node: protocol for built-ins: `import { join } from 'node:path'`
- All shared constants in `Skript/shared/constants.ts`
- TUI (`tui/`) excluded from tsconfig and biome — do not touch
