# WS7 — Surface Hidden Features & Information-Architecture Cleanup

> **Depends on:** WS0 (`ScreenContainer`, spacing). Largely parallel to WS3–WS6.
> **Goal:** Connect the powerful, fully-built features that are currently unreachable, and make navigation consistent and safe. This is where the app gains "more functionality that helps the user" without building much net-new.

---

## What's built but dark (verified)

1. **Ask Rosebud** — `app/ask-rosebud.tsx` (216 lines, fully functional time-range-filtered journal Q&A) + `services/ask-rosebud/askRosebud.ts` + `hooks/ask-rosebud/useAskRosebud.ts`. Route **registered** at `app/_layout.tsx:107` but **no UI navigates to it**. Completely unreachable.
2. **Memory Graph** — `components/memory-graph/*` (WebView engine, filters, header, detail sheet, `useMemoryGraph` hook) all complete, but **no route renders it** as a screen.
3. **Memory inspection** — `components/settings/MemorySettingsSection.tsx` (atom counts, profile preview, generated note, manual notes, clear) is buried inside Settings, despite memory being the **backbone of every chat** (the capsule injected at `app/chat.tsx:70-79`). `deleteMemoryAtom` exists (`services/memory/localMemory.ts:131-137`) with **no UI**.
4. **Saved insights** — `app/saved-insights.tsx` exists; Ask Rosebud has no link to it.
5. **Static insights** — `app/(tabs)/insights.tsx` charts (emotions, themes, characters) are non-interactive; no drill-down to entries or the graph.

## Navigation hygiene (verified)

- **Orphan `/modal`** — registered (`app/_layout.tsx:111`, `app/modal.tsx`) but never navigated to. Template leftover.
- **Inconsistent navigation** — tabs use `router.navigate` (`hooks/navigation/useTabNavigation.ts:10`); header actions mix `navigate` + `push` (`useHeaderActions.ts:8/12/15`); `app/(tabs)/settings.tsx:35` bypasses `useTabNavigation` and calls `router.push('/(tabs)/...')` directly.
- **Bare `router.back()`** on deep-linkable detail screens (`entry-detail.tsx:85`, `checkin-detail.tsx:38`, `goals.tsx:33`) — can land on an unexpected screen or exit the app.
- **Auth redirect hardcoded** to `/(tabs)/settings` (`login.tsx:41`).

---

## Deliverables

### 7.1 Memory / "About Me" hub (rebuild the `explore` tab)
The `explore` tab is currently a thin memory-graph screen seeded by the slop `new-plan.md`. Make it the real **Memory home** (`app/(tabs)/explore.tsx`), built on `ScreenContainer` (WS0):
- **Profile** card — editable "About me" (the profile-layer memory), pulled from `useLocalMemories`.
- **Themes** — interactive tag cloud from semantic atoms; tapping a theme → filtered entries or the graph.
- **Atoms** — searchable, filterable list with **per-atom delete** (wire the existing `deleteMemoryAtom`) and confidence/salience badges. Extract `components/memory/MemoryAtomCard.tsx`.
- **Notes** — manual + generated notes (reuse logic from `MemorySettingsSection`), with the generated suggestion shown prominently + "why" (its source themes).
- **"Explore graph"** button → `/memory-graph`.
- Keep `MemorySettingsSection` in Settings as a thin link to this hub (don't duplicate logic — extract shared pieces into `components/memory/`).

### 7.2 `app/memory-graph.tsx` (new route)
Thin screen wrapping the existing `useMemoryGraph` + `MemoryGraphWebView` + `MemoryGraphFilters` + `MemoryGraphHeader` + `MemoryGraphSheet`. Register in `app/_layout.tsx`. Accept optional prefilter params (e.g., `?layer=semantic&tag=career`) so insights/themes can deep-link into it. Add a legend (layer colors + connection-strength meaning).

### 7.3 Surface Ask Rosebud
- Add a prominent **"Ask about your journal"** card/action on `app/(tabs)/insights.tsx` (and optionally a Today card) → `router.push('/ask-rosebud')`.
- In `app/ask-rosebud.tsx`, add a header link to **Saved insights** (`/saved-insights`) and a clearer title/intro. Keep its existing time-range filter.
- This finally makes a 216-line finished feature reachable.

### 7.4 Interactive insights
In `app/(tabs)/insights.tsx` + `components/insights/*`:
- Make `KeyThemes` chips pressable → `/memory-graph?tag=<theme>` or filtered entries.
- Make `EmotionalLandscapeChart` bars pressable → entries matching that mood.
- Make `CastOfCharacters` items pressable → entries mentioning that person.
- Strengthen the unlock messaging (also WS8): show `X/5 entries` progress upfront, not just "Unlocks Saturday."

### 7.5 Navigation standardization
- **Delete** `app/modal.tsx` + its `Stack.Screen` in `app/_layout.tsx:111`.
- **`hooks/navigation/useNavBack.ts`** (new): wraps `router.back()`, falling back to a sensible default (`/(tabs)/entries` or the originating tab) when the back stack is empty. Adopt in `entry-detail.tsx`, `checkin-detail.tsx`, `intentions/detail.tsx`, `goals.tsx`, `saved-insights.tsx`, `streak-view.tsx`.
- **Standardize**: tab↔tab → `navigate('/(tabs)/x')` (route everything through `useTabNavigation`, including `settings.tsx:35`); tab→detail/modal → `push`; backward → `useNavBack`.
- **Auth redirect by referrer**: `login.tsx`/`signup.tsx` accept a `redirectTo` param (default `/(tabs)/today`) instead of hardcoded settings.

### 7.6 IA result
Tabs stay 5 + FAB: `Today · explore→**Memory** · Insights(+Ask Rosebud, interactive) · History · Settings`, with Memory Graph and Ask Rosebud reachable from there. No new tab slot needed; three buried power-features become discoverable.

---

## Files touched

| File | Change |
|---|---|
| `app/(tabs)/explore.tsx` | rebuild as Memory/"About Me" hub on `ScreenContainer` |
| `components/memory/MemoryAtomCard.tsx`, `components/memory/*` | **new** — extracted, reusable memory UI (delete/edit, badges) |
| `app/memory-graph.tsx` | **new** — route wrapping existing graph components |
| `app/_layout.tsx` | register `/memory-graph`; **delete** `/modal` screen |
| `app/modal.tsx` | **delete** |
| `app/(tabs)/insights.tsx` | Ask-Rosebud card; pressable themes/emotions/characters; unlock progress |
| `components/insights/KeyThemes.tsx`, `EmotionalLandscapeChart.tsx`, `CastOfCharacters.tsx` | make pressable |
| `app/ask-rosebud.tsx` | title/intro; link to saved-insights |
| `components/settings/MemorySettingsSection.tsx` | thin link to Memory hub (extract shared logic) |
| `hooks/navigation/useNavBack.ts` | **new** |
| `hooks/navigation/useHeaderActions.ts`, `useTabNavigation.ts` | standardize navigate/push |
| `app/(tabs)/settings.tsx` | route tabs via `useTabNavigation` |
| `app/(auth)/login.tsx`, `signup.tsx` | `redirectTo` param |
| detail screens (`entry-detail`, `checkin-detail`, `intentions/detail`, `goals`, `saved-insights`, `streak-view`) | adopt `useNavBack` |

> Watch the 500-line limit: the Memory hub must stay modular — push lists/cards into `components/memory/`.

---

## Tests

- `__tests__/screens/MemoryHub.test.tsx`: renders profile/themes/atoms/notes; per-atom delete calls `deleteMemoryAtom`.
- `__tests__/screens/MemoryGraphRoute.test.tsx`: route renders graph; prefilter params applied.
- `__tests__/screens/AskRosebudReachable.test.tsx`: Insights renders the Ask-Rosebud entry point and navigates.
- `__tests__/hooks/useNavBack.test.ts`: empty stack → fallback route; non-empty → `back()`.
- `__tests__/nav/no-orphan-modal.test.ts`: `/modal` no longer registered; `app/modal.tsx` removed.
- Insights interactivity: pressing a theme navigates with the expected params.

---

## Acceptance criteria (screenshot QA)

- `explore` tab is a real Memory/"About Me" hub; atoms are searchable and individually deletable; "Explore graph" opens the graph.
- Ask Rosebud is reachable from Insights, works, and links to saved insights.
- Tapping an insight theme/emotion/character drills into the graph/entries.
- `/modal` is gone; deep-linking a detail screen and pressing back lands somewhere sane.
- Tab switching is consistent everywhere; auth returns to the right place.
- Light + dark pass for the new Memory hub and graph route; all gates green.
