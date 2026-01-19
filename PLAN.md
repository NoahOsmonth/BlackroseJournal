# Epic Plan: Recreating Journal App Design and Core User Flows

## Goal
Implement the end-to-end user journeys described in the epic spec (Daily check-in, Today dashboard navigation, Stats exploration, Happiness Recipe, Ask Rosebud insights, Entry continue/new, Rewards, Settings), while keeping the repo modular and test-covered.

## Source of Truth
- Epic spec (external): `Core_User_Flows.md` (Traycer export)
	- Path on this machine: `C:\Users\sigmu\AppData\Local\Temp\traycer-epics\0f02090c-8f30-4dd2-ab53-d9f2b5be945f-Recreating_the_Journal_App_Design_and_Functionality\specs\fb8d0fd0-5284-4c15-893b-64bef17de642-Core_User_Flows.md`

## Design References
- Today dashboard: `example-design/today.html`
- Entries/history: `example-design/journal-history.html`

## Current Baseline (Already Implemented)
The repo already includes:
- Journal entry persistence (AsyncStorage-backed service)
- Chat markdown rendering for AI responses
- Therapist-style AI system prompt
- Entries/history screen + basic navigation (tabs + chat)
- Finish Entry + draft-on-close

This run focuses on the remaining (or spec-mismatched) flows.

## Scope (What to Build)
1. Today dashboard UI + weekday selector + calendar shortcut to Entries
2. Daily check-in flow: time-based prompt selection + chat initialization context
3. Bottom navigation: 5 items with centered FAB + header navigation (Rewards/Menu)
4. Stats detail modals for Streak/Entries/Words
5. Happiness Recipe: ingredients + goals management (add/edit/complete/delete) + completed screen
6. Ask Rosebud: insights chat with time range selector + tappable entry references
7. Entry tap action modal: Continue Entry (append messages) vs Create New Entry
8. Rewards screen (streak + achievements)
9. Settings screen (theme + stubs for notifications/export/about/privacy)
10. Typography/theme alignment between example designs (Nunito vs Inter) using theme tokens

## Stack
- Expo + Expo Router
- TypeScript
- NativeWind / Tailwind
- Jest + @testing-library/react-native
- AsyncStorage persistence

## Architecture/Separation of Concerns
- UI: `app/`, `components/`
- Orchestration/state: `hooks/`
- I/O/services: `services/`
- Avoid UI importing services directly (prefer hooks)

## Quality Gate
```bash
npm run lint
npm test -- --runInBand
npm run check:design
```

## Testing Expectations
- Add/extend unit tests for new utilities/services.
- Add component tests for:
	- Today screen navigation actions
	- Entry tap action modal
	- Ask Rosebud time range selector behavior
- If a feature requires manual-only verification (animations, haptics), document it in PROGRESS and keep `passes=false` for that story.

## Definition of Done
- All acceptance criteria across tasks satisfied
- Designs match the provided HTML references (spacing, colors, typography)
- No design/UI file exceeds 500 lines (per AGENTS.md)
- Quality gate commands pass
