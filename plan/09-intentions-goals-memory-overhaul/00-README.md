# 09 — Intentions, Goals UI & Memory Architecture Overhaul

> **Audience:** an execution-only AI agent. Follow this plan literally, file by file.
> **Authored:** 2026-06-11. All file paths, line numbers, and code excerpts were verified against the working tree on this date. If a FIND block does not match exactly, re-read the target file first — do NOT guess.

---

## What this plan delivers

| Phase | File | Goal |
|-------|------|------|
| A | `01-spacing-and-goals-ui-fix.md` | Fix the cramped/ugly "Today's goals" buttons AND the repo-wide root cause: `space-y-*`/`space-x-*` are silently dropped by NativeWind v4 on native (zero spacing). |
| B | `02-intention-chat-redesign.md` | Redesign the Morning/Evening intention chat to match the `+` button journal chat: same "Go deeper" + "Finish entry" footer design, same input component, AI-generated titles — while still saving as a `morning` / `evening` intention check-in. |
| C | `03-memory-architecture-hardening.md` | Fix 10 audited bugs in the local memory system: write race conditions, crash-on-corrupt-data, unbounded growth, duplicate/conflicting types, ID collisions, stale cross-screen state, prompt bloat. Adds schema versioning + migration + tests. |
| D | `04-agents-md-update.md` | Replace `AGENTS.md` with a tightened version that encodes the new failure modes discovered in phases A–C. |
| E | `05-final-verification.md` | Full verification checklist. Run last. |

**Execution order: A → B → C → D → E.** Phases A, B, C are independent in code but A introduces the `gap-*` convention that B's new components must follow, so keep the order.

---

## Global rules (apply to every phase)

1. **Read `/home/sarino/Desktop/BlackroseJournal/AGENTS.md` before starting.** Its rules are binding until Phase D replaces it (the replacement keeps all of them).
2. **After completing each phase**, run from the repo root:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run check:design
   npm test
   ```
   All four must pass before starting the next phase. If a failure is pre-existing (verify with `git stash` → rerun → `git stash pop`), note it in `PROGRESS.md` and continue; otherwise fix it.
3. **Every `<Text>` you write needs a `dark:` color variant.** Every icon color must be theme-aware. (AGENTS.md rule #1.)
4. **Never use `space-y-*` or `space-x-*` classes in any code you write.** Use `gap-*` on the flex container. (Root cause explained in Phase A.)
5. **UI files must stay ≤ 500 lines** (`npm run check:design` enforces this).
6. **Tests are part of the diff.** Each phase lists its required tests.
7. **Do not touch:** lockfiles, `supabase/migrations/`, `example-design/`, generated files, `node_modules/`.
8. **Update `PROGRESS.md`** at the end of each phase: one bullet per change + test results.
9. When a step says `FIND:` / `REPLACE WITH:`, do an exact string replacement. Whitespace and indentation in FIND blocks match the real files (4-space indent in most files, 2-space in `components/FooterActions.tsx` and `components/InlineTypingInput.tsx`).

---

## Architecture context you need (read once)

This is an Expo Router React Native app (NativeWind 4.2.1, RN 0.81.5). Layering rule: **UI → hooks → services**, never skip, never reverse.

Two parallel chat surfaces exist:

| | Journal chat (`+` button) | Intention chat (morning/evening) |
|---|---|---|
| Screen | `app/chat.tsx` | `app/intentions/chat.tsx` |
| Entry point | FAB in `components/journal/BottomNav.tsx` → `router.push('/chat')` | Cards on `app/(tabs)/today.tsx:112-118` → `router.push({ pathname: '/intentions/chat', params: { type: 'morning' \| 'evening' } })` |
| Orchestration | `useChatOrchestration` (shared, `features/chat/`) | `useChatOrchestration` (same hook) |
| Footer | `components/FooterActions.tsx` — "Go deeper" (primary) + "Finish entry" | `components/intentions/IntentionChatFooter.tsx` — old "Finish entry" + "Suggest" design (replaced in Phase B) |
| Input | `components/InlineTypingInput.tsx` (animated, ref-controlled) | bare `TextInput` inside `IntentionChatBody` (replaced in Phase B) |
| Saves to | `JournalEntry` → AsyncStorage `@journal_entries` via `services/journal/journalStorage.ts` | `IntentionCheckIn` (`type: 'intention' \| 'morning' \| 'evening'`) → AsyncStorage `@intention_checkins` via `services/intentions/intentionsStorage.ts` |
| On finish | AI title + analysis, then `/entry-reflection` | summary-as-title, then today tab / intention detail |

**Phase B unifies the *design and interaction* of the intention chat with the journal chat but keeps the intention save path** (`IntentionCheckIn` with `type: 'morning' | 'evening'`) — that is exactly what the product owner asked for: "dig deeper same as the + button, but it should save as morning or night intention."

Storage keys in play:

| Key | Service |
|---|---|
| `@journal_entries` | `services/journal/journalStorage.ts` |
| `@intention_checkins`, `@intentions` | `services/intentions/intentionsStorage.ts` |
| `@goals` | `services/goals/goalsStorage.ts` |
| `@rosebud_local_memory` | `services/memory/localMemory.ts` (rewritten in Phase C) |

---

## Definition of done for the whole plan

- [ ] Phases A–E all completed in order.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run check:design`, `npm test` all green.
- [ ] No `space-y-`/`space-x-` classes remain in `app/` or `components/` (guard test from Phase A enforces this).
- [ ] Morning/Evening intention chat uses the new footer ("Go deeper" + "Finish entry"), `InlineTypingInput`, AI title generation, and still writes `IntentionCheckIn` rows with `type: 'morning'`/`'evening'`.
- [ ] `services/memory/localMemory.ts` has: serialized writes, corruption-safe load, schema-versioned envelope (v2) with v1 migration, pruning cap, change subscriptions, required `sourceId`. All covered by tests.
- [ ] `AGENTS.md` replaced with the Phase D content.
- [ ] `PROGRESS.md` updated.
