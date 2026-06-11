# WS5 — Guided AI Conversations for Morning / Evening / Intention Flows

> **Depends on:** WS2 (`ChatFlow`), WS3 (persona), WS4 (tuning) — to feel complete. Build after those.
> **Goal:** Make morning/evening check-ins and intention-setting feel like *warm, guided AI conversations*, not generic chat or forms. Address the user's "morning and night journal & setting intention should be AI chat … looks dumb and sucks."

---

## Premise correction (verified — important)

The flows are **already chat-based**, not manual forms:
- `app/(tabs)/today.tsx:109-115`: morning/evening → `router.push('/intentions/chat', { type: 'morning'|'evening' })`.
- `app/intentions/select.tsx:38`: pick area → `/intentions/chat?area=...`.
- The **only genuine manual form** (`components/intentions/IntentionForm.tsx`) is reached **only via the edit path** (`app/intentions/edit.tsx:53-61`).

So "looks dumb" ≠ "it's a form." The real weaknesses:

1. **Morning and evening use the identical generic prompt.** `buildIntentionSystemPrompt` (`services/intentions/intentionPrompts.ts:13-47`) ignores time-of-day — a morning intention and an evening reflection get the same opener and tone. The well-written period prompts in `constants/dailyPrompts.ts:22-47` exist but are only wired to the *main chat's* `dailyCheckIn` mode, **never** to intention check-ins.
2. **Bare, cold opener.** The initial turn is `triggerText: '[Start intention check-in]'` (`app/intentions/chat.tsx:143-147`) resolving to a canned opener — not a warm, contextual greeting.
3. **No scaffolding for new intentions.** Picking an area drops the user straight into an open-ended chat with no structure, so it feels aimless.
4. **The edit path is a dry form** while everything else is conversational — jarring inconsistency.
5. **Dead UI:** `components/today/DailyJournalingCard.tsx` has **zero usages** (verified) — leftover from an abandoned design.

---

## Deliverables (all expressed as `ChatFlow`s from WS2)

### 5.1 Time-aware morning/evening prompts
Upgrade `buildIntentionSystemPrompt` (`services/intentions/intentionPrompts.ts`) to accept `checkInType` and pull period-appropriate language from `constants/dailyPrompts.ts`:
- **morning** → forward-looking: energy, one intention for the day, what would make today good. Warm "good morning" framing.
- **evening** → reflective: what happened, gratitude, what to release, gentle close. "Winding down" framing.
- **intention (area)** → the guided scaffold (5.2).

The `morning`/`evening`/`intention` `ChatFlow.buildSystemPrompt` (WS2 registry) delegates here, then `composeSystemPrompt` weaves persona + memory + feedback. So time-awareness, persona, and memory all compose cleanly.

### 5.2 Guided staged intention-setting (new intentions)
When `intentionId` is undefined (new intention from `intentions/select`), run a **3-stage scaffold** via `ChatFlow.stages` (WS2 `GuidedStage[]`), enforced through the system prompt so the AI moves the user through:
1. **Clarify** — "What's calling for your attention in {areaLabel} right now?"
2. **Envision** — "What would success here look and feel like?"
3. **Commit** — "What's one concrete step you could take this week?"

The flow advances stages using lightweight heuristics (`GuidedStage.isComplete`) or simply by turn count; the system prompt instructs the AI to gently progress and not interrogate. On finish, the existing `handleFinish` (`app/intentions/chat.tsx:254-328`) already creates the intention + first check-in — keep that, just feed it richer, scaffolded content.

### 5.3 Warm contextual openers
Replace the bare `[Start intention check-in]` trigger with `ChatFlow.openingMessage(ctx)`:
- morning: "Good morning ☀️ Let's set the tone for your day. How are you arriving here this morning?"
- evening: "Evening. Let's gently look back on your day — what's most present for you right now?"
- intention(area): stage-1 question above, personalized with `areaLabel`.

These run through the existing `initialPrompt`/`sendInitialMessage` path so the AI's *first* message is a generated, warm greeting (not canned text). Persona tone (WS3) colors it automatically.

### 5.4 Conversational refine replaces the edit form
Add an `intentionRefine` flow. `app/intentions/edit.tsx` currently renders `IntentionForm`. Change the **primary** edit affordance to open `/intentions/chat?intentionId=...&mode=refine`, which loads the existing intention and opens with: *"I see you're working on '{intention.title}'. What would you like to adjust or build on?"* Then conversationally updates the intention on finish.
- **Demote** `IntentionForm` to an "Advanced / direct edit" fallback reachable from an overflow menu — don't delete it (some users want direct editing), just make conversation the default.

### 5.5 Remove dead UI
Delete `components/today/DailyJournalingCard.tsx` (zero usages) and any stale export in `components/today/index.ts`. (Confirm with `grep -rn DailyJournalingCard` first — verified zero non-self references at plan time.)

### 5.6 Kill the "coming soon" dead affordances (here; also tracked in WS8)
`app/intentions/chat.tsx:402-403` shows `Alert.alert('Voice input', '… coming soon')` / image upload. Either hide these footer buttons until implemented or disable them with a subtle "not yet" state — no fake affordances. (Decide in WS8's pass; flagged here because it lives in this screen.)

---

## Files touched

| File | Change |
|---|---|
| `services/intentions/intentionPrompts.ts` | time-aware prompt by `checkInType`; staged-intention prompt |
| `constants/dailyPrompts.ts` | reused for morning/evening language (maybe minor additions) |
| `constants/intentionChat.ts` | replace bare trigger with opener helpers |
| `features/chat/flows/index.ts` | `morning`/`evening`/`intention`/`intentionRefine` flows + openers + stages |
| `app/intentions/chat.tsx` | select flow by `type`/`area`/`mode`; use opener; handle refine load |
| `app/intentions/edit.tsx` | default to conversational refine; demote form to advanced |
| `components/today/DailyJournalingCard.tsx` | **delete** (dead) |
| `components/today/index.ts` | drop dead export |

---

## Tests

- `__tests__/services/intentions/intentionPrompts.test.ts`: morning vs evening produce distinct prompts; staged prompt includes the 3 stages; area label injected.
- `__tests__/features/chatFlows.guided.test.ts`: morning/evening/intention openers non-empty and distinct; `intentionRefine` references the existing title.
- `__tests__/screens/IntentionRefine.test.tsx`: editing an intention opens chat with the refine opener; finishing updates the intention.
- Guard: a test asserting `DailyJournalingCard` is no longer imported anywhere.

---

## Acceptance criteria (screenshot QA)

- Morning check-in opens with a warm, forward-looking greeting; evening opens with a distinct reflective one — clearly different tone/content.
- New intention (pick an area) walks through clarify → envision → commit, feeling guided not aimless.
- Editing an intention opens a conversation ("What would you like to adjust?"), with a direct-edit form still available under "Advanced."
- Active persona (WS3) visibly colors all of the above; generation tuning (WS4) applies.
- No "coming soon" alerts firing from fake buttons.
- All gates green; no dead `DailyJournalingCard` reference.
