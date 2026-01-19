# Review Log

## 2026-01-19 — AI streaming + SafeArea + env config review

### Executive summary
- Core functional fixes look correct: mobile streaming degrades gracefully, SafeArea deprecation warning should be addressed, and unit coverage was added.
- Automated verification is strong: all Jest suites pass and design/UI file-size limits pass.
- **Critical security gap remains:** `.env` is currently tracked by git, which can leak API keys even if `.gitignore` now includes it.

### What changed (high-level)
- `services/ai.ts`: capability-detect streaming and fall back to non-streaming when `response.body` is unavailable; improved error context.
- `services/aiConfig.ts` + `app.config.ts`: centralized AI config (Expo `extra` + safe fallbacks).
- `app/_layout.tsx`: added `SafeAreaProvider` at the app root.
- Tests: `__tests__/services/ai.test.ts` (streaming + fallback + missing-key + HTTP error) and `__tests__/SafeAreaViewImports.test.ts` regression guard.
- Docs/infra: `.env.example`, `.gitignore`, `README.md` updated.

### Verification status
- ✅ `npm test -- --runInBand` (17/17 suites passing)
- ✅ `npm run check:design` (0 errors, 0 warnings)
- ⚠️ `npm run lint`: ran; output did not show issues (consider capturing/confirming the final “no issues” line in CI logs)
- ⚠️ Manual mobile verification not performed in this review: confirm the "Response body is null" redbox is gone on a real device/simulator.

---

## Issues

### P0 — `.env` is tracked by git (secret leakage risk)
**Impact:** High. Even if `.env` is now in `.gitignore`, a previously tracked `.env` remains in the repo index/history. If it contains a real `NANO_GPT_API_KEY`, it’s already compromised.

**Where:** Repo root `.env` (tracked); `.gitignore` now includes `.env` but does not untrack existing files.

**How to reproduce:**
- Run `git status --porcelain` and observe `.env` appears with `M` (tracked & modified), not `??` (untracked).

**Proposed fix:**
- Remove `.env` from git tracking (`git rm --cached .env`) while keeping it locally for developers.
- Rotate the exposed key(s).
- Consider purging git history if a real key was ever committed (BFG Repo-Cleaner / git filter-repo) and re-rotate.
- Add a CI guard (script) that fails if `.env` becomes tracked again.

**Acceptance criteria:**
- `git ls-files .env` returns nothing.
- `.env` is absent from the repository index and future commits.
- Key rotation completed and documented.

### P1 — Missing-key UX is developer-friendly, not user-friendly
**Impact:** Medium. The app logs an error and stops loading/spinner state, but users may have no clue what happened if chat fails.

**Where:** `features/chat/hooks/useChatOrchestration.ts` error handlers + UI.

**Proposed fix:**
- Show a non-blocking inline error banner/toast in chat (“AI is not configured” / “Network error, try again”).

**Acceptance criteria:**
- When AI fails, user sees a clear message and a retry action; input re-enabled.

### P2 — Minor maintainability nits
**Impact:** Low.

**Where:** `services/aiConfig.ts` formatting/indentation differs from nearby code style.

**Proposed fix:**
- Run formatter / align indentation and export naming conventions.

**Acceptance criteria:**
- File matches repo formatting standards; no functional change.
