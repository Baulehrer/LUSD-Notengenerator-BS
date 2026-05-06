# Task Completion Checklist

After completing any task:
1. `bun test` — all 57 tests must pass
2. `bunx tsc --noEmit` — no type errors (tui/ excluded)
3. `bunx biome check .` — no lint/format errors (tui/ excluded)
4. Manual smoke test: `bun run dev` → server boots in ~40ms

Commit: pre-commit hook runs the above automatically when `git config core.hooksPath .githooks` is set.
