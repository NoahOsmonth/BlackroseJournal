# docs/ — Documentation Index

One screen. For the root-level documents (`PLAN.md`, `PROGRESS.md`,
`memory.md`, `AGENTS.md`, `README.md`, `QA-Plan.md`) see the map in
[`../PLAN.md`](../PLAN.md); this index covers everything under `docs/`.

## Read in this order

| # | Document | What it is |
|---|---|---|
| 1 | [`plans/blackrose-design-rewrite.md`](plans/blackrose-design-rewrite.md) | The approved screen-level design plan (referenced by `constants/theme.ts`, `tailwind.config.js`) |
| 2 | [`superpowers/specs/2026-09-19-explore-write-path-design.md`](superpowers/specs/2026-09-19-explore-write-path-design.md) | Latest design spec: the Explore write path (plus its [HTML visual companion](superpowers/specs/2026-09-19-explore-memory-architecture.html)) |
| 3 | [`qa/TEST_PLAN.md`](qa/TEST_PLAN.md) | QA suite index + live status dashboard |
| 4 | [`qa/DEFECTS.md`](qa/DEFECTS.md) | Defect log (DEF-001–014) |

## What lives where

```
docs/
├── plans/          Approved forward-looking design plans (screen level)
├── superpowers/
│   ├── plans/      Historical executable plans (kept for line-level traceability)
│   └── specs/      Their design specs, incl. the HTML visual companion
├── compose/spec/   Agent-loop finality spec
└── qa/
    ├── cases/      The test-case tracker (one CSV per suite; retired/ for history)
    ├── results/    Dated run summaries (run1–run3)
    ├── TEST_PLAN.md    Suite index + status dashboard
    ├── DEFECTS.md      Defect log
    └── AI-HANDOFF-PROMPT.md   Self-contained executor prompt for a QA AI
```

## Conventions

- **Historical ≠ wrong.** `docs/superpowers/` documents how things were built;
  for what is true *now*, read [`../PROGRESS.md`](../PROGRESS.md) and
  [`../memory.md`](../memory.md).
- **QA execution** touches only `docs/qa/**`, `QA-Plan.md`, and
  `PROGRESS.md` — never app code (see `QA-Plan.md` §7).
- Evidence screenshots referenced by QA runs live in gitignored `output/`
  at run time; the run summaries inline everything that matters.
