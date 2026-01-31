## Plan: Remove configs and adb

Remove Babel config, package.json files, review doc, nativewind/tailwind configs, and adb directory while leaving app/backend runtime source intact. Document the change in PROGRESS.md.

**Phases 3 phases**
1. **Phase 1: Remove build/config files**
    - **Objective:** Delete Babel, package.json, review, and nativewind/tailwind config files.
    - **Files/Functions to Modify/Create:** babel.config.js, package.json, backend/package.json, REVIEW.md, nativewind-env.d.ts, tailwind.config.js
    - **Tests to Write:** Not applicable (tests removed by request)
    - **Steps:**
        1. Delete the specified config files.
        2. Verify no app/backend runtime files are touched.
2. **Phase 2: Remove adb directory**
    - **Objective:** Delete adb tooling directory.
    - **Files/Functions to Modify/Create:** adb/
    - **Tests to Write:** Not applicable
    - **Steps:**
        1. Delete the adb directory recursively.
3. **Phase 3: Document the change**
    - **Objective:** Record the removal in the progress log.
    - **Files/Functions to Modify/Create:** PROGRESS.md
    - **Tests to Write:** Not applicable
    - **Steps:**
        1. Add a short note describing removed configs and adb.

**Open Questions 0 questions**
