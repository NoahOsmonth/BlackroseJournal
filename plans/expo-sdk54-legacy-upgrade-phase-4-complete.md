## Phase 4 Complete: Remove warning sources in code

Removed deprecated header wrappers and added a guard test to prevent legacy header usage from returning.

**Files created/changed:**
- components/today/TodayHeader.tsx
- components/journal/JournalHeader.tsx
- __tests__/warning-cleanup.test.ts

**Functions created/changed:**
- N/A (legacy wrappers removed)

**Tests created/changed:**
- __tests__/warning-cleanup.test.ts

**Review Status:** APPROVED

**Git Commit Message:**
refactor: remove deprecated header wrappers

- replace legacy header wrappers with empty stubs
- add warning cleanup test for headers and variants
- keep AppHeader as the shared header entry
