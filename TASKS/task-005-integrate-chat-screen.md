# Task 005: Strengthen Tests & Quality Gates

## Problem
Refactors and modularization are only safe if tests protect behavior and if the repo has a consistent quality gate.

## Impact
- Regressions slip in during "cleanup" work.
- Contributors can't easily verify changes locally.

## Proposed Fix
1. Add/extend tests for newly extracted hooks/services using user-centric assertions.
2. Ensure tests cover success + failure paths for services.
3. Ensure quality gate commands are consistent:
	- keep `npm run lint`
	- keep `npm test`
	- (optional) add `npm run typecheck` if feasible with current TS config

## Acceptance Criteria
- Any new hook/service has unit tests covering success + failure paths.
- Tests prefer rendered text/accessibility queries over implementation details.
- Quality gate commands are documented and runnable.
- All tests pass.

## References
- `__tests__/`
- React Native testing overview: https://reactnative.dev/docs/testing-overview
- RNTL Quick Start: https://oss.callstack.com/react-native-testing-library/docs/start/quick-start

## Subtasks
- Add tests for extracted chat hook/service logic as needed.
- Add/adjust npm scripts (`typecheck` optional).

## Verification
- Run `npm test -- --runInBand`.
- Run `npm run lint`.

