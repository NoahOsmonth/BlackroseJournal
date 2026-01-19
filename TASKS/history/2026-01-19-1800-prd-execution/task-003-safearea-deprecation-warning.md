# Task 003: Eliminate SafeAreaView deprecation warning

## Problem
Runtime warning:

- `SafeAreaView has been deprecated and will be removed in a future release. Please use 'react-native-safe-area-context' instead.`

The app already uses `react-native-safe-area-context` in many screens, so this warning likely comes from:
- an accidental import from `react-native` somewhere in app code/tests
- a dependency path (less likely, but possible)

## Impact
- Noisy logs
- Future React Native upgrades may break layouts if deprecated APIs are removed

## Proposed Fix
- Identify the source of the warning (file + import path).
- Replace any usage of `SafeAreaView` from `react-native` with `react-native-safe-area-context`.
- Ensure a `SafeAreaProvider` is present high in the tree (recommended by library docs).
- Add a regression guard (test or lint rule) to prevent reintroducing `react-native` SafeAreaView imports.
- If the warning originates in a dependency and cannot be fixed locally:
  - upgrade the dependency (preferred)
  - or ignore the specific warning via LogBox with a comment and tracking issue (last resort)

## Acceptance Criteria
- Running the app no longer prints the SafeAreaView deprecation warning from app code.
- A `SafeAreaProvider` exists at the app root (unless Expo Router already provides one; document either way).
- A regression guard exists so new imports from `react-native` SafeAreaView fail CI/tests.

## References
- Safe Area Context usage (provider + consumers):
  - https://appandflow.github.io/react-native-safe-area-context/usage

## Subtasks
1. Find the source of the warning:
   - search for `SafeAreaView` imports/requires from `react-native`.
2. Fix app code to use `react-native-safe-area-context`.
3. Add `SafeAreaProvider` at the top of the app if missing.
4. Add a regression guard test.

## Verification
### Unit tests
- `npm test -- --runInBand`

### Manual (required)
- Run on mobile and confirm warning is gone.
