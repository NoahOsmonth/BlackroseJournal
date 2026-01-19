# Task 004 (Review): Untrack `.env` + rotate any exposed AI keys

## Problem
`.env` is currently tracked by git (shows up as `M .env` in `git status`). This defeats the purpose of `.gitignore` and can leak secrets (like `NANO_GPT_API_KEY`) via commits and repository history.

## Impact
- High security risk: API keys can be harvested from git history.
- Violates the intent of CHORE-002 (safe configuration management).

## Proposed Fix
1. **Stop tracking `.env`** while keeping it usable locally:
   - Remove it from git index (keep file locally).
   - Confirm it is ignored going forward.
2. **Rotate any previously exposed key(s)** (Nano GPT dashboard).
3. **(If a real key was ever committed)**: purge history using `git filter-repo` or BFG, then rotate again.
4. Add a **guardrail** to prevent regression:
   - Add a small CI/script check (e.g., `git ls-files .env` must be empty).

## Acceptance Criteria
- `.env` is not tracked: `git ls-files .env` returns nothing.
- `.env` remains in `.gitignore`.
- `.env.example` exists with placeholders only.
- Key rotation is completed and documented (where/when).
- CI/automation fails if `.env` becomes tracked again.

## Verification
- `git status --porcelain` shows no `.env` tracked changes.
- Tests still pass: `npm test -- --runInBand`.
