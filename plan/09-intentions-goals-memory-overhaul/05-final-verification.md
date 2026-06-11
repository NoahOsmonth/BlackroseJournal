# Phase E — Final verification (run after A–D are complete)

## 1. Static gates (all must pass from repo root)

```bash
npx tsc --noEmit
npm run lint
npm run check:design
npm test
cd backend && npx tsc --noEmit && npm test && cd ..
```

## 2. Greps that must return nothing

```bash
grep -rn "space-y-\|space-x-" app components --include="*.tsx"          # Phase A complete
grep -rn "onSuggest" app components features                             # Phase B removed it
grep -rn "testID=\"intention-chat-input\"" app components                # old input is gone
grep -rEn "LocalMemoryAtom\b" services/memory/memoryGraph.types.ts       # renamed to MemoryGraphAtom
```

And greps that must match (sanity that the new code exists):

```bash
grep -n "withMemoryLock" services/memory/localMemory.ts
grep -n "schemaVersion" services/memory/localMemory.ts
grep -n "subscribeMemoryChanges" services/memory/localMemory.ts hooks/memory/useLocalMemoryContext.ts
grep -n "FooterActions" components/intentions/IntentionChatFooter.tsx
grep -n "InlineTypingInput" components/intentions/IntentionChatBody.tsx
grep -n "title?: string" services/intentions/intentionChatCompletion.ts
grep -rn "no-space-utilities" __tests__
```

## 3. Targeted test suites

```bash
npm test -- --testPathPattern="no-space-utilities"
npm test -- --testPathPattern="localMemory"
npm test -- --testPathPattern="Intention"
npm test -- --testPathPattern="goals|Goals"
```

## 4. Manual QA matrix (light + dark mode each)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Today tab → "Today's goals" section | Title, card, and the "Add goal"/"Manage" buttons have visible breathing room (12–16px); buttons no longer touch |
| 2 | "Manage" → Goals & Habits screen | Goal rows and habit rows separated by visible 12px gaps |
| 3 | "Add goal" → quick-add modal | Goal/Habit toggle pills have 12px gap; Cancel/Save unchanged |
| 4 | Today tab → "Morning Intention" card | Intention chat opens with "MORNING INTENTION - <date>" label, AI opening message, animated inline input |
| 5 | Type a reply → tap "Go deeper" | Primary (filled) button, identical design to the `+` chat; message sends; "Thinking..." indicator shows until streaming starts |
| 6 | Press Enter / submit in the input | Same as "Go deeper" |
| 7 | Tap "Finish entry" | Buttons disable while saving; lands on Today; Morning card shows the completed checkmark; check-in saved with `type: 'morning'`, AI-generated title (fallback: first-message excerpt if backend down) |
| 8 | Repeat 4–7 with "Evening Reflection" | Same, with `type: 'evening'` and "EVENING REFLECTION" label |
| 9 | Close intention chat mid-conversation | Draft saved; resumable from Drafts with messages intact |
| 10 | `+` FAB journal chat | Unchanged behavior (regression check): Go deeper / Finish entry / entry-reflection routing |
| 11 | Settings → add a manual memory note → open `+` chat | Memory capsule includes the note without app restart |
| 12 | Finish a journal entry → memory graph | New atoms appear; filters, search, node insight still work |
| 13 | Kill the app mid-write simulation (optional, dev menu reload during entry finish) → relaunch | App opens without crash; memory features still work (corruption path returns clean state) |

Backend note: scenarios 5–8 and 11–12 need the local AI backend running (`cd backend && npm run dev`, `EXPO_PUBLIC_AGENT_BASE_URL` set). Scenario 7's title fallback path can be tested by stopping the backend.

## 5. Documentation closeout

- `PROGRESS.md` has an entry per phase: what changed, defects fixed (cite the Phase C defect numbers), test evidence, any deferred follow-ups.
- Confirm `AGENTS.md` equals the Phase D content.
- If anything was deferred or any FIND block had drifted and required adaptation, list it explicitly in `PROGRESS.md` under "Deviations from plan 09".
