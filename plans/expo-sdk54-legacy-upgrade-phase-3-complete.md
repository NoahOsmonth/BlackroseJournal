## Phase 3 Complete: Align dependencies to Legacy Architecture

Aligned legacy-safe dependencies and stabilized Babel config for NativeWind + Reanimated, with tests confirming compatibility.

**Files created/changed:**
- package.json
- package-lock.json
- babel.config.js
- __tests__/deps-compat.test.ts
- __tests__/babel-config.test.ts

**Functions created/changed:**
- N/A (configuration only)

**Tests created/changed:**
- __tests__/deps-compat.test.ts
- __tests__/babel-config.test.ts

**Review Status:** APPROVED

**Git Commit Message:**
feat: align legacy deps and babel config

- remove dev-client/worklets and pin reanimated v3
- set nativewind babel preset and jsx runtime
- add deps and babel config tests
