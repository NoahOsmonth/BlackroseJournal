## Phase 1 Complete: Restore package + test harness

Recreated the project’s package metadata and Jest scaffolding so tests run again with a baseline sanity check.

**Files created/changed:**
- package.json
- package-lock.json
- jest.config.js
- jest.setup.js
- __tests__/config-baseline.test.ts

**Functions created/changed:**
- N/A (configuration only)

**Tests created/changed:**
- __tests__/config-baseline.test.ts

**Review Status:** APPROVED

**Git Commit Message:**
feat: restore package and test scaffolding

- add package.json aligned with lockfile
- add jest config/setup and baseline test
- fix verbose test script flag
