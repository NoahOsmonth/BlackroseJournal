Run summaries (one markdown file per session, named `YYYY-MM-DD-run<N>.md`) go here after execution sessions.

Template:

```markdown
# QA Run — YYYY-MM-DD (Run N)

- Executor:
- Build/commit:
- Pre-flight gate: test / tsc / lint / check:design →
- Environment notes (ports, scheme, data state):

## Cases executed
| Case ID | Title | Status | Notes |
|---|---|---|---|

## Defects opened
- DEF-### (Case ID): summary

## Carry-over / follow-ups
- …
```
