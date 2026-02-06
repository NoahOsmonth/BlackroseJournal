## Plan: Expo SDK 54 Legacy Upgrade

Restore missing Expo config and test scaffolding, align dependencies to SDK 54 with Legacy Architecture, eliminate deprecations, and document the outcome for a clean mobile-only build.

**Phases 5**
1. **Phase 1: Restore package + test harness**
    - **Objective:** Recreate `package.json` with SDK 54 dependencies and working test scripts, then bring back Jest config and a baseline test.
    - **Files/Functions to Modify/Create:** `package.json`, `jest.config.js`, `jest.setup.js`, `__tests__/config-baseline.test.ts`
    - **Tests to Write:** `config-baseline.test.ts` (sanity check for package scripts + test harness loading)
    - **Steps:**
        1. Add Jest config and a failing baseline test.
        2. Create `package.json` scripts/deps from `package-lock.json` and make the test pass.
        3. Re-run the test to confirm green.
2. **Phase 2: Restore app/build configs**
    - **Objective:** Recreate app and build config files needed to run Expo SDK 54 cleanly.
    - **Files/Functions to Modify/Create:** `app.json`, `babel.config.js`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `nativewind-env.d.ts`
    - **Tests to Write:** `app-config.test.ts` (asserts app config name/slug/platforms and key flags)
    - **Steps:**
        1. Add a failing test that reads app config and checks required fields.
        2. Create config files to satisfy the test and Expo defaults.
        3. Re-run tests to confirm green.
3. **Phase 3: Align dependencies to Legacy Architecture**
    - **Objective:** Ensure dependency set is compatible with Expo SDK 54 on Legacy Architecture and dev-client is disabled.
    - **Files/Functions to Modify/Create:** `package.json`, `package-lock.json`, `__tests__/deps-compat.test.ts`
    - **Tests to Write:** `deps-compat.test.ts` (asserts reanimated v3 range, dev-client absent, and legacy-friendly config)
    - **Steps:**
        1. Add a failing dependency-compat test.
        2. Update dependencies and lockfile to legacy-compatible versions.
        3. Re-run tests to confirm green.
4. **Phase 4: Remove warning sources in code**
    - **Objective:** Refactor any deprecated API usage that would surface warnings under SDK 54.
    - **Files/Functions to Modify/Create:** impacted app/components files; `__tests__/warning-cleanup.test.tsx`
    - **Tests to Write:** `warning-cleanup.test.tsx` (user-facing assertions for modified UI/logic)
    - **Steps:**
        1. Write failing tests for updated UI/logic.
        2. Refactor code to pass tests and remove warning sources.
        3. Re-run tests to confirm green.
5. **Phase 5: Document outcomes**
    - **Objective:** Record changes and any follow-ups in `PROGRESS.md`.
    - **Files/Functions to Modify/Create:** `PROGRESS.md`
    - **Tests to Write:** None.
    - **Steps:**
        1. Summarize changes, tests added, and any remaining manual steps.
        2. Ensure documentation aligns with final state.

**Open Questions 3**
1. Confirm `blackrosejournal` for app name and slug (defaulting to `com.blackrosejournal` identifiers).
2. Which icon/splash assets should be wired in the app config, or use existing defaults for now?
3. OK to keep Hermes default (not Hermes v1) since JSC is no longer bundled in RN 0.81?
