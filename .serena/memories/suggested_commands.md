# Suggested Commands

All commands run from `Skript/` directory.

```bash
bun run start        # Run TUI (not maintained)
bun run dev          # Run web server with HMR (bun --hot main.ts)
bun test             # Run all tests
bun test core/grades.test.ts  # Run specific test file
bunx tsc --noEmit    # Type check
bunx biome check .   # Lint + format check
bunx biome check . --write  # Auto-fix lint+format issues
bun run build        # Build standalone executables
```
