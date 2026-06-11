# WS8 — AI-Slop Elimination & Design-System Consolidation

> **Depends on:** WS0 (spacing/tokens). Runs in parallel with WS3–WS7; should be the **closing polish lane**.
> **Goal:** Remove placeholder/AI-slop content and unify the design system so the app looks intentional and consistent in both light and dark mode. This directly serves "find AI slop UI and improve them … best UI/UX."

---

## Verified offenders

1. **Placeholder identity** — `app/(tabs)/settings.tsx:226` ships `'Journal App v1.0.0\n\nYour personal AI-powered journaling companion.'` — generic template copy + hardcoded version, wrong app name.
2. **Fake "coming soon" affordances** — `app/intentions/chat.tsx:402-403` `Alert.alert('Voice input', '… is coming soon.')` and image upload. Buttons that do nothing.
3. **Undefined color token (invisible UI)** — `components/today/WeekdaySelector.tsx:55` uses `bg-accent-green/10` and `:56` color `#32D74B`, but **`accent-green` is not defined in `tailwind.config.js`** (verified). NativeWind silently drops it → invisible badge background. This is the canonical "undefined token" bug AGENTS.md warns about.
4. **Hardcoded hex colors scattered in components** (should be tokens/`useColorScheme`): `components/journal/BottomNav.tsx:68-98` (`bg-black/90`, `text-white`, `#FFFFFF`/`#000000` — also breaks light mode), `EntryInsightsCard.tsx` (`#9CA3AF`), `DailyJournalingCard.tsx:73-80`, `WeekdaySelector.tsx:56`, plus icon colors across `today/*`, `drafts.tsx`, `persona/advanced.tsx`.
5. **AI-slop fallback strings** — `components/history/HistoryWeekSummary.tsx:31` hardcodes `"quiet, reflective, open"`; vague `"Not enough data"` in `KeyThemes.tsx:18` / `CastOfCharacters.tsx:15`; `"No memory nodes yet"` in `explore.tsx`. No actionable empty states.
6. **Weak unlock messaging** — `app/(tabs)/insights.tsx:108-113` "Unlocks Saturday" without showing `X/5` progress.
7. **Two clashing theme systems** — `constants/theme.ts:92-100` exports a `theme` object (cyan `#45f3ff`, dark `#0b0c10`) that is **slop bleed from `new-plan.md`** and conflicts with the real `Colors` palette (orange `#FF9F0A`). Anything importing `theme.colors` gets an off-brand palette.

---

## Deliverables

### 8.1 Real branding + dynamic version
- `constants/appInfo.ts` (new): `APP_NAME = 'BlackroseJournal'`, `APP_TAGLINE`, and `APP_VERSION` read from `expo-constants` / `package.json` (`version: '0.0.1'`) rather than a hardcoded "1.0.0".
- Update `app/(tabs)/settings.tsx` About section to use these + genuine, honest privacy copy (the app is local-first per `idea.md` — say that truthfully).

### 8.2 Kill "coming soon"
- `app/intentions/chat.tsx`: remove the voice/image footer buttons (or render them visibly disabled with a tooltip), no fake alerts. Decide with the user during QA whether to hide or disable; default = **hide** until implemented.

### 8.3 Define missing tokens + centralize colors
- Add `accent-green` (and any other grep-found undefined token) to `tailwind.config.js` with light/dark values; this fixes the invisible WeekdaySelector badge.
- `constants/iconColors.ts` + `hooks/theme/useIconColors.ts` (new): a single source for icon colors per scheme (e.g., `primary`, `muted`, `onDark`). Replace scattered hex (`#9CA3AF`, `#6B7280`, `#32D74B`, `#FFFFFF`, `#000000`, `#60A5FA`, `#34D399`, etc.) in components with these.
- Keep the existing `dark-mode-contrast.test.ts` guard green (it catches hardcoded icon colors) — this work should make it *stronger*; extend it to cover the newly cleaned files.

### 8.4 Theme-tokenize `BottomNav`
`components/journal/BottomNav.tsx` hardcodes a black glass bar + white text/icons — it **ignores light mode**. Refactor to theme tokens (`bg-surface-* dark:bg-…`, `text-text-* dark:…`, icon colors via `useIconColors`). It should look correct in light mode, not just dark.

### 8.5 Reconcile the clashing `theme` export
- Audit imports of `theme` from `constants/theme.ts` (`grep -rn "theme.colors\|from '@/constants/theme'"`). The slop `theme` object (cyan/`#0b0c10`) should be **removed or remapped** to the real `Colors`/`MemoryLayerColors`. The memory-graph WebView legitimately uses `MemoryLayerColors` — keep those; drop the conflicting `background/surface/text/primary` cyan values. Ensure nothing renders off-brand cyan.

### 8.6 Actionable empty states
- `components/ui/EmptyState.tsx` (new): icon + message + optional CTA. One pattern, reused.
- Replace vague fallbacks with count-to-unlock + CTA:
  - Insights locked → "Write {5 - n} more entries to unlock weekly insights → [Start an entry]".
  - Memory/explore empty → "Your memory grows as you journal. [Write your first entry]".
  - KeyThemes/CastOfCharacters empty → encouraging, specific guidance (not "Not enough data").
- Remove the hardcoded `"quiet, reflective, open"` summary fallback; derive from real data or show the empty state.

### 8.7 Hierarchy & spacing polish
- Apply `constants/spacing.ts` (WS0) consistently; strengthen card hierarchy (bolder primary text, clearer secondary) in `GoalsSection`, `EntryInsightsCard`, `MyIntentionsSection`.
- Unify header horizontal padding (WS0 `SCREEN_PADDING_X`) across `AppHeader`, `Header`, `MemoryGraphHeader`.

---

## Files touched

| File | Change |
|---|---|
| `constants/appInfo.ts` | **new** — name/tagline/version |
| `app/(tabs)/settings.tsx` | real branding + honest privacy copy |
| `app/intentions/chat.tsx` | remove fake voice/image affordances |
| `tailwind.config.js` | define `accent-green` + any other undefined token |
| `constants/iconColors.ts`, `hooks/theme/useIconColors.ts` | **new** — centralized icon colors |
| `components/journal/BottomNav.tsx` | theme tokens; light-mode correct |
| `components/today/WeekdaySelector.tsx`, `EntryInsightsCard.tsx`, `GoalsSection.tsx`, `MyIntentionsSection.tsx` | tokens, hierarchy |
| `constants/theme.ts` | remove/remap the slop `theme` export; keep `Colors`/`MemoryLayerColors` |
| `components/ui/EmptyState.tsx` | **new** |
| `components/history/HistoryWeekSummary.tsx`, `components/insights/KeyThemes.tsx`, `CastOfCharacters.tsx`, `app/(tabs)/explore.tsx` | actionable empty states |
| `app/(tabs)/insights.tsx` | unlock progress `X/5` |
| `components/navigation/AppHeader.tsx`, `components/Header.tsx`, `components/memory-graph/MemoryGraphHeader.tsx` | unified padding |

---

## Tests

- Extend `__tests__/tailwind-config.test.ts`: assert `accent-green` (and any added token) exists; keep the 23-token guard.
- Extend `__tests__/dark-mode-contrast.test.ts`: cover `BottomNav`, `WeekdaySelector`, and other de-hexed files — no hardcoded icon colors remain.
- `__tests__/components/EmptyState.test.tsx` (new): renders message + optional CTA.
- `__tests__/settings/appInfo.test.ts` (new): version comes from package metadata, not a literal "1.0.0"; app name is "BlackroseJournal".
- `__tests__/no-coming-soon.test.ts` (new): grep guard — no `"coming soon"` string in `app/`/`components/`.
- `__tests__/no-slop-theme.test.ts` (new): the cyan `#45f3ff`/`#0b0c10` slop palette is gone from `constants/theme.ts`.

---

## Acceptance criteria (screenshot QA)

- Settings shows "BlackroseJournal" + the real version + honest, specific copy.
- No "coming soon" alerts anywhere; no dead buttons.
- WeekdaySelector "today" badge is visible in both modes (token defined).
- `BottomNav` looks correct in **light** mode (not a black bar with invisible content).
- Every empty state is actionable with a CTA; no "Not enough data" / hardcoded mood fallback.
- No off-brand cyan anywhere; the palette is the orange-accented system end-to-end.
- `dark-mode-contrast` + `tailwind-config` guards green; all other gates green.
