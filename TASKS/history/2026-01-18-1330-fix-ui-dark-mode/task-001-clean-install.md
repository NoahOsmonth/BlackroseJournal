# Task: Clean and Reinstall Dependencies

## Problem
`npm run start` fails with `EACCES: permission denied` in `node_modules`. This indicates corrupted permissions or file locks.

## Proposed Fix
1. Remove `node_modules` directory.
2. Remove `package-lock.json`.
3. Run `npm install`.
4. Verify with `npm run start`.

## Verification
- Run `npm run start` and ensure Metro Bundler starts without crashing.
