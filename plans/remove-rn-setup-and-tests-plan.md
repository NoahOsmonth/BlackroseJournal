## Plan: Remove RN setup and tests

Remove Expo/React Native setup files and all tests/configs while preserving app design, runtime functionality, and backend logic. This focuses on configuration and test scaffolding cleanup per request.

**Phases 3 phases**
1. **Phase 1: Remove RN setup files**
    - **Objective:** Delete Expo/React Native setup files and TypeScript configs.
    - **Files/Functions to Modify/Create:** app.json, app.config.ts, GEMINI.md, tsconfig.json, backend/tsconfig.json
    - **Tests to Write:** Not applicable (tests are being removed; document exception in PROGRESS.md)
    - **Steps:**
        1. Delete the listed config files.
        2. Verify no design or runtime files are touched.
2. **Phase 2: Remove tests and test configs**
    - **Objective:** Remove all test suites and test scaffolding.
    - **Files/Functions to Modify/Create:** __tests__/, tests/, backend/tests/, jest.config.js, jest.setup.js, playwright.config.ts, __mocks__/
    - **Tests to Write:** Not applicable (tests are being removed; document exception in PROGRESS.md)
    - **Steps:**
        1. Delete all files under the test directories listed.
        2. Delete Jest/Playwright config and mocks.
3. **Phase 3: Document the change**
    - **Objective:** Record that tests were removed per request.
    - **Files/Functions to Modify/Create:** PROGRESS.md
    - **Tests to Write:** Not applicable
    - **Steps:**
        1. Add a short note explaining tests were removed by request.

**Open Questions 0 questions**
