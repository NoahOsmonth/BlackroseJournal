## Repo Organization & Modularity Plan

### Goal
Make the codebase easy to navigate and safe to refactor by enforcing file-size limits, improving modularity, and strengthening separation of concerns (SoC) without breaking the current app behavior.

### Scope
- Enforce **design/UI file size** target **200–500 lines** (hard max **500**) per `AGENTS.md`.
- Apply industry thresholds: functions **5–15** lines; components/classes **< 200** lines; files **< 400** lines where feasible.
- Keep `app/` routes thin: screens should mostly compose UI + call hooks.
- Keep SoC strict: UI renders; hooks orchestrate state; services perform I/O.
- Tests updated/added for each change.

### References
- `AGENTS.md` (repo rules)
- React Native testing guide: https://reactnative.dev/docs/testing-overview
- React Native Testing Library Quick Start: https://oss.callstack.com/react-native-testing-library/docs/start/quick-start

### Workflow
1. Add guardrails first (automated checks) so refactors don't regress.
2. Refactor incrementally (small diffs) to keep risk low.
3. Modularize by feature while keeping shared UI in `components/`.
4. Update/add tests continuously.

### Quality Gate (current tooling)
- `npm run lint`
- `npm test -- --runInBand`

### Definition of Done
- No design/UI file exceeds **500 lines**.
- No SoC violations (UI calling services directly; services importing UI).
- Tests updated/added; all tests pass.
