<PLAN>PLAN.md</PLAN>
<TASKS>TASKS/</TASKS>
<PROGRESS>PROGRESS.md</PROGRESS>

You are a coding agent in VS Code Copilot Chat. Run CONTINUOUSLY and complete ALL tasks in one run.

Stop rule:
- If a file named PAUSE.md exists, stop immediately and reply: Paused

Mandatory reads:
- AGENTS.md (if present)
- PLAN.md
- TASKS/*
- PROGRESS.md
- prd.json (if present)

Task selection:
- Work tasks in priority order (or the order listed in PROGRESS.md).
- Do NOT ask the user what to do next; make reasonable assumptions and continue.
- If blocked on a task, document the assumption or skip to the next task; do not stop.

Repo rules (must follow):
- Follow AGENTS.md if present.
- Prefer Context7 for documentation lookups; use web fetch only if Context7 lacks coverage.
- Add or update tests for new behavior when feasible; if not, document why in PROGRESS.md.
- Treat verification as required; manual-only verification must keep passes=false.

Quality gate (auto-detect stack):
- Run lint/typecheck/build/test commands that exist in the repo tooling.
- Prefer targeted tests over full-suite runs.

Commands for this repo:
```bash
npm run lint
npm test -- --runInBand
npm run check:design
```

Progress updates:
- After each task, update PROGRESS.md: check the task and append an update block with what changed, files edited, commands run, and verification.

Finish:
- Verify all acceptance criteria for each task.
- Update prd.json to set passes: true for completed tasks.
- Never set passes: true unless the quality gate commands complete successfully (including targeted tests); if commands fail or are not run, leave passes: false and note why in PROGRESS.md.
- Provide concise, conventional commit messages (one per task).
- If you cannot run commands, list the exact commands for the user to run.
- Stop only when all tasks are done.

## Task Execution Order

1. **Task 001: Storage Service** - Foundation for all persistence
2. **Task 002: Markdown Rendering** - AI response formatting
3. **Task 003: Therapist Prompt** - AI personality/tone
4. **Task 004: Journal History Screen** - Main UI matching HTML design
5. **Task 005: Navigation Flow** - FAB, X button, tabs
6. **Task 006: Finish Entry** - Save completed entries
7. **Task 007: Draft Functionality** - Auto-save on close

## Key Design Reference

Match `example-design/journal-history.html` exactly for:
- Colors (primary: #E91E63, backgrounds, surfaces, text colors)
- Typography (Inter font, sizes, weights)
- Component layout (header, entry cards, week sections, FAB, bottom nav)
- Light/dark mode transitions

## Dependencies to Install

```bash
npm install @react-native-async-storage/async-storage react-native-markdown-display
```

## File Size Rules (AGENTS.md)

- Design/UI files: 200-500 lines target, 500 max
- Functions: 5-15 lines
- Components: < 200 lines
- Split when approaching 450 lines
