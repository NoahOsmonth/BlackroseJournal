# Epic Plan: Finish Entry Reflection + Suggestions to Habits

## Goal
After the user presses **Finish entry** in chat, show an AI-generated **Entry Reflection** screen (reflection + key insight + suggestions) followed by an AI-generated **streak haiku** celebration. Suggestions marked as **HABIT** must be addable to the user’s Happiness Recipe as a new **habit** type displayed **below Ingredients**.

## Design References
- Provided screenshots (Entry Reflection screen, Suggestions list with HABIT badge + Add to list, 1 Day Streak Haiku celebration)

## Non-goals / Explicit Exclusions
- Do **not** implement or show an “Add to long-term memory” upsell section.

## Current Baseline
This repo already includes:
- Chat journaling flow with **Finish entry**
- Journal persistence via AsyncStorage (`services/journalStorage.ts`)
- AI service wrapper (`services/ai.ts`)
- Happiness Recipe (ingredients + goals) (`app/happiness-recipe.tsx`, `services/happinessRecipeStorage.*`)

## Scope (What to Build)
1. Finish Entry -> Entry Reflection flow (new screen + navigation)
2. AI-generated reflection content (reflection body + key insight + suggested habits)
3. Suggestions list UI (HABIT cards with Add to list)
4. Add a new Happiness Recipe item type: **habit**, rendered **below Ingredients**
5. Streak celebration screen/modal with AI-generated haiku

## Stack
- Expo + Expo Router
- TypeScript
- NativeWind / Tailwind
- Jest + @testing-library/react-native
- AsyncStorage persistence

## Architecture / Separation of Concerns
- UI in `app/` + `components/`
- Orchestration in `hooks/`
- Persistence/AI in `services/`
- UI should not import storage/AI services directly; use hooks

## Quality Gate
```bash
npm run lint
npm test -- --runInBand
npm run check:design
```

## Testing Expectations
- Update existing tests for Finish Entry navigation and add new tests for:
  - EntryReflection screen rendering and Continue flow
  - Suggestions “Add to list” adds a habit item
  - Happiness Recipe supports habit type and renders it below ingredients

## Definition of Done
- Finish Entry reliably navigates into the Reflection flow without breaking save behavior
- Suggestions add habits to Happiness Recipe and persist across restarts
- No “long-term memory” UI is present
- Tests updated/added and quality gate passes
- UI/design files stay under 500 lines (per AGENTS.md)
