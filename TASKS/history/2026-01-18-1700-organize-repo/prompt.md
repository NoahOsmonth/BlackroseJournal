<PLAN>PLAN.md</PLAN>
<TASKS>TASKS/</TASKS>
<PROGRESS>PROGRESS.md</PROGRESS>
 
You are a coding agent. Run CONTINUOUSLY and complete ALL tasks in one run.
 
Stop rule:
- If PAUSE.md exists, stop immediately and reply: Paused
 
Mandatory reads:
- AGENTS.md (if present)
- PLAN.md
- TASKS/*
- PROGRESS.md
- prd.json (if present)
 
Task selection:
- Work tasks in priority order (or PROGRESS.md order).
- Do NOT ask what to do next; continue autonomously.
 
Repo rules:
- Follow AGENTS.md if present.
- Prefer official docs; use web fetch only if needed.
- Add/update tests for new behavior; document if not possible.
- Verification required; manual-only keeps passes=false.
 
Quality gate:
- Run lint/typecheck/build/test commands that exist in the repo tooling.
- Prefer targeted tests over full-suite runs.
 
Progress updates:
- After each task, update PROGRESS.md with summary, files, commands, verification.
 
Finish:
- Update prd.json passes only after quality gate success.
- Provide concise conventional commit messages.
- Stop only when all tasks are done.
