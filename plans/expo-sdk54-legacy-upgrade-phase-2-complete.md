## Phase 2 Complete: Restore app/build configs

Recreated the core Expo config and build setup for SDK 54, including NativeWind/Tailwind and a config validation test.

**Files created/changed:**
- app.json
- babel.config.js
- tsconfig.json
- tailwind.config.js
- postcss.config.js
- nativewind-env.d.ts
- __tests__/app-config.test.ts

**Functions created/changed:**
- N/A (configuration only)

**Tests created/changed:**
- __tests__/app-config.test.ts

**Review Status:** APPROVED

**Git Commit Message:**
feat: restore expo app/build configs

- add app.json with mobile-only expo settings
- add babel/tsconfig and nativewind/tailwind configs
- add app config validation test
