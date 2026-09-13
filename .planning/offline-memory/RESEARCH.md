# Offline Memory Rework — RESEARCH.md

## 1. What the user asked
- Offline memory tools that work when Hindsight (embeddings) and Supabase are down; data saves through the phone offline.
- Optional Google Drive backup (manual file, agreed).
- No embeddings. Pure tool-calling. Simple + easy yet high quality.
- Reference architectures: Hermes agent, OpenClaw, and (deep dive) **ClawXMemory** (`OpenBMB/ClawXMemory`).

## 2. Sources studied
- Hermes docs: `MEMORY.md` (2200 chars) + `USER.md` (1375 chars), frozen snapshot at session start, `memory` tool (add/replace/remove, substring match, no read — injected), char-limit error forces consolidate-in-turn, SQLite FTS5 `session_search` for unbounded history, external providers run *alongside* never replacing.
- OpenClaw docs: `USER.md` + `MEMORY.md` + `memory/YYYY-MM-DD.md` daily notes + `DREAMS.md`; bootstrap injection with head-75/tail-25 truncation; `memory_search` / `memory_get` / `intent` tools; dreaming sweep (thresholded promotion, taint-gated, reviewable); memory flush before compaction.
- ClawXMemory repo (full source read): `clawxmemory/src/core/{types,file-memory,retrieval/reasoning-loop,skills/llm-extraction,pipeline/heartbeat,review/dream-review,storage/sqlite}` + `tools.ts` + `prompt-section.ts`, plus both architecture images (`docs/image/build_en.png`, `inference_en.png`).

## 3. ClawXMemory build pipeline (build_en.png)
```
Raw Dialogue → Topic Segmentation (episodes) → Memory Unit Construction
(Summary + Metadata + Linked Dialogue) → Multi-view Memory Organization
  → Project-based Memory Index (project-centric clustering)
  → Temporal Memory Index (chronological timeline)
  → User Profile (Preferences / Background / Style)
```
- Durable memory = **markdown files with flat frontmatter**: `name, description, type (user|feedback|project), scope (global|project), project_id, updated_at, captured_at, source_session_key, deprecated, dream_attempts`, body in fixed `##` sections (Project: Stage/Decisions/Constraints/Next Steps/Blockers/Timeline/Notes; Feedback: Rule/Why/How to apply/Notes; User: Profile/Preferences/Constraints/Relationships).
- **SQLite holds only the control plane** (raw L0 sessions, settings, traces) — never vectors. File bodies are the source of truth, inspectable on disk.
- Indexing is **background + staged**: new sessions → `_tmp` project files first → Dream promotes to formal projects. Nothing jumps straight to formal.
- Extraction is **LLM with strict JSON schema** (summary, situation_time_info, facts[], projects[]) + conservative rules (no invention, omit ambiguity) + **deterministic local fallbacks** (regex/keyword hints) when the model is down.

## 4. ClawXMemory inference pipeline (inference_en.png)
```
Q ─┐
   ├─ Route(Q, M) → none | user | project_memory   (M = Global User Profile)
M ─┘
L2 Retrieve Memory Indices (project + time; report what's Missing) → Prioritize(L2) → headers
L1 Retrieve related project/feedback files → headers
L0 Retrieve related raw dialogue → evidence
→ Construct Memory Context from selected files ONLY (budgets: 12k chars/file, 30k total)
```
- **Gate first**: `route=none` short-circuits to zero injection (saves context on greetings/smalltalk). Exact project-name mention overrides a `none` gate.
- **Headers before bodies**: recall scans only frontmatter + first ~30 lines / 16KB per file (manifest scan), LLM picks top-K=5 file ids, bodies load only for winners. Never stuffs raw history.
- **Single-project focus**: lexical shortlist (exact +10, token +2, description +1, workspace +2, recent-message merge, top-5) → LLM selects ONE formal project → disambiguation block (never invent names) when unresolved.
- **Caches + traces**: 30s recall cache keyed on (query, snapshot version, mode); every step emits a structured trace (gate/shortlist/manifest/files/context) for the dashboard.

## 5. ClawXMemory tool + prompt doctrine (tools.ts, prompt-section.ts)
- Six tools, three hot: `memory_search` (gated recall, returns context + refs + disambiguation flag) → `memory_get` (exact ids only) → `memory_list` (browse by kind/query/project, paginated). Plus `memory_overview`, `memory_flush` (index now), `memory_dream` (consolidate now).
- Prompt rule: *search first, then get exact ids; never write memory files directly; memory files are the only long-term store* (no parallel `memory/*.md` shadow systems).

## 6. ClawX Dream (consolidation) rules worth copying
- Global plan decides project boundaries BEFORE any rewrite; merges require `merge_reason` (rename | alias_equivalence | duplicate_formal_project) + evidence entry ids; **when unsure, keep separate** (explicit anti-umbrella rule with examples).
- Per-project rewrite preserves **atomic granularity** (small files, merge only clear redundancy), every output cites ≥1 source id; deleted ids must be absorbed/redundant.
- User profile rewrite keeps durable identity only, never project progress/tasks.

## 7. Mapping onto Blackrose (what we keep / add)
| ClawX concept | Blackrose today | Plan |
|---|---|---|
| `user-profile.md` | `@rosebud_identity_profile` + extraction | Keep store; add `_tmp`-style staging? No — keep direct, add `memory` add/replace/remove tool (Hermes pattern) |
| Project index (formal + `_tmp`) | theme atoms (`theme:<key>`) unstructured | **Formalize**: `projects/<threadId>/project.meta.md`-equivalent JSON docs + `Project/*.md` + `Feedback/*.md` equivalents in AsyncStorage; `_tmp` staging on finish; Dream promotes |
| Temporal index | `@blackrose_day_digests` | Keep as-is = L2 time axis |
| L0 raw sessions | journal/check-in storage + `get_conversation` | Keep; already the L0 evidence layer |
| Recall gate + header scan + single-project select | `search_history` flat keyword | **Replace recall core** with route→shortlist→manifest→bodies + budgets + 30s cache + trace |
| Tools | 10 tools incl. `recall_memory` (Hindsight) | Add `memory_search` / `memory_list` / `memory_get` (+`memory_overview`/`memory_flush`/`memory_dream`); demote `recall_memory` to fallback (agreed) |
| Export bundle v3 | `localBackup.ts` (local only) | **Extend**: same snapshot shape → Drive `appDataFolder` JSON via `expo-auth-session` + REST (Expo Go compatible, no native modules) |
| SQLite control plane | AsyncStorage + locks | **Stay on AsyncStorage** (no new native deps); keep rule-4 lock + safe-parse + schemaVersion envelope |

## 8. Decisions locked with user
- Scope: full Hermes/OpenClaw-class architecture, ClawX as the structural model (not a shallow patch).
- Drive v1: **manual backup file** (export/import JSON, appDataFolder).
- Hindsight: **fallback, not primary** — on-device recall first, Hindsight only when on-device misses.

## 9. Risks / constraints
- No `expo-sqlite` today → header-scan must run over AsyncStorage indexes (keep a lightweight manifest doc, never full-scan bodies per turn).
- Android ~2MB/key → keep sharding (session digests precedent); memory files stay one-doc-per-file.
- Free-model context → budgets (12k/file, 30k total, top-K 5) are load-bearing, not cosmetic.
- AGENTS.md rules: layering (UI→hooks→services), lock + safe-parse, no `space-*`, dark: variants, tests in diff, no `any`.
