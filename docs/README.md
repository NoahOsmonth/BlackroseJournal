# docs/ — Documentation Index

One screen. This index covers everything under `docs/`. Root-level docs are
`memory.md` (memory-system contract), `AGENTS.md` (rules), and `README.md`
(app overview). Forward work lives on the Kaneo board, not in a repo file:
<http://192.168.1.188:5173>.

## Read in this order

| # | Document | What it is |
|---|---|---|
| 1 | [`plans/blackrose-design-rewrite.md`](plans/blackrose-design-rewrite.md) | The approved screen-level design plan (referenced by `constants/theme.ts`, `tailwind.config.js`) |
| 2 | [`perf/ui-performance-rules.md`](perf/ui-performance-rules.md) | UI performance rules + numeric budgets for tab switches, and how to measure them |
| 3 | [`qa/TEST_PLAN.md`](qa/TEST_PLAN.md) | QA suite index + live status dashboard |
| 4 | [`qa/DEFECTS.md`](qa/DEFECTS.md) | Defect log (DEF-001–014) |

## What lives where

```
docs/
├── plans/          Approved forward-looking design plans (screen level)
├── perf/           UI performance rules, budgets, and the tab-switch bench
├── compose/spec/   Agent-loop finality spec
└── qa/
    ├── cases/      The test-case tracker (one CSV per suite; retired/ for history)
    ├── results/    Dated run summaries
    ├── TEST_PLAN.md    Suite index + status dashboard
    └── DEFECTS.md      Defect log
```

## Conventions

- **Historical ≠ wrong.** For what is true *now*, read [`../memory.md`](../memory.md)
  and the dated run summaries in [`qa/results/`](qa/results/).
- **QA execution** touches only `docs/qa/**` — never app code.
- Evidence screenshots referenced by QA runs live in gitignored `output/`
  at run time; the run summaries inline everything that matters.
