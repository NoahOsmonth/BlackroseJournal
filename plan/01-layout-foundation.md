# WS0 — Layout Foundation

> **Depends on:** nothing. **Unblocks:** every other UI workstream.
> **Goal:** Kill edge-hugging and overlap *systemically* by creating one spacing source of truth and one screen wrapper, then adopt them everywhere. After this, every later screen fix is a one-line adoption rather than a bespoke patch.

---

## Problem evidence (verified)

1. **Bottom safe area disabled on all 7 screens** — `edges={['top']}`:
   - `app/(tabs)/today.tsx:164`, `app/(tabs)/entries.tsx:55`, `app/(tabs)/insights.tsx:247`, `app/(tabs)/explore.tsx:46`, `app/(tabs)/settings.tsx:178`, `app/chat.tsx:252`, `app/intentions/chat.tsx:373`.
   - Content scrolls under the home indicator on devices with a bottom inset.
2. **Hardcoded `paddingBottom: 140`** in tab ScrollViews (`today.tsx:176`, `entries.tsx:64`) does **not** equal the real `BottomNav` height. `BottomNav` (`components/journal/BottomNav.tsx:68-70`) computes `paddingBottom: (insets.bottom||0)+16` on top of `pt-3 pb-8` → variable ~80–110px. The static 140 is a guess that's wrong on most devices (content either floats too high or hides behind nav).
3. **Chat footer overlaps the last message** — in `app/chat.tsx` the `FooterActions` (line 351) sits *inside* the ScrollView with only `contentContainerStyle={{ paddingBottom: 20 }}` (line 259). On a full screen the input + footer crowd the last bubble.
4. **Header padding inconsistency** — `AppHeader` uses `px-4`, `app/intentions/select.tsx` uses `p-5`, `components/memory-graph/MemoryGraphHeader.tsx` uses `px-5`, `components/Header.tsx` uses `px-4`. No single horizontal-padding constant.
5. **Fragile timeline spine** — `app/(tabs)/entries.tsx:69` hardcodes `left-[16px]` to line up with the ScrollView's `px-4` (16px). Any padding change silently misaligns the spine.
6. **Modal sheets can sit under the nav** — `today.tsx:269` ("More options") and `intentions/detail.tsx` action sheets use `inset-0 justify-end` with only `p-6`.
7. **`MemoryGraphSheet` uses `bottom-28`** (`components/memory-graph/MemoryGraphSheet.tsx`) — a fixed 112px that may not clear the nav on large insets.

---

## Deliverables

### 0.1 `constants/spacing.ts` (new — single source of truth)

```ts
/**
 * Spacing & layout constants.
 * Single source of truth for screen padding, bottom-nav clearance, and the
 * history timeline indent. Use these instead of magic numbers so a change in
 * one place propagates everywhere (prevents the timeline-spine drift bug).
 */
export const SCREEN_PADDING_X = 20;          // px — standard horizontal gutter (today uses px-5)
export const HISTORY_PADDING_X = 16;         // px — entries timeline gutter (px-4)
export const TIMELINE_INDENT = HISTORY_PADDING_X; // spine must match the gutter
export const BOTTOM_NAV_BASE_HEIGHT = 84;    // px — BottomNav content height excluding safe-area inset
export const CONTENT_BOTTOM_GAP = 16;        // px — breathing room above the nav

/** Bottom padding a scroll view needs to clear the floating BottomNav. */
export function navAwareBottomPadding(insetBottom: number): number {
  return BOTTOM_NAV_BASE_HEIGHT + insetBottom + CONTENT_BOTTOM_GAP;
}
```

> **Tune `BOTTOM_NAV_BASE_HEIGHT` against the real component during screenshot QA** — measure the rendered `BottomNav` and adjust this one constant. Everything else derives from it.

### 0.2 `components/ui/ScreenContainer.tsx` (new — the wrapper every screen adopts)

Responsibility: wrap a screen in `SafeAreaView` with **all** edges (or top-only when a floating `BottomNav` already handles the bottom inset — see prop), apply the standard max-width + horizontal padding, and expose a computed bottom padding for scroll content.

```tsx
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** 'all' for screens without a floating nav (chat, detail); 'top' when BottomNav handles bottom inset. */
  edges?: 'all' | 'top';
  /** Adds the standard horizontal gutter to the inner column. */
  padded?: boolean;
  className?: string;
}

export function ScreenContainer({
  children, edges = 'all', padded = false, className = '',
}: ScreenContainerProps) {
  const edgeProp = edges === 'all' ? (['top', 'bottom'] as const) : (['top'] as const);
  return (
    <SafeAreaView
      className="flex-1 bg-background-light dark:bg-background-dark"
      edges={edgeProp}
    >
      <View className={`flex-1 max-w-md mx-auto w-full ${padded ? 'px-5' : ''} ${className}`}>
        {children}
      </View>
    </SafeAreaView>
  );
}
```

**Important nuance:** tab screens keep a **floating** `BottomNav` (absolute-positioned), so their `SafeAreaView` should NOT add a bottom edge that double-counts — instead, the *ScrollView's* `contentContainerStyle.paddingBottom` uses `navAwareBottomPadding(insets.bottom)` and the `BottomNav` itself already pads with `insets.bottom`. So:
- **Tab screens** (`today`, `entries`, `insights`, `explore`, `settings`): `edges="top"` on the container, ScrollView gets `navAwareBottomPadding`.
- **Non-tab full screens** (`chat`, `intentions/chat`, detail screens, persona): `edges="all"`.

### 0.3 Per-screen adoption

For each **tab screen**, replace the static `paddingBottom: 140` with the computed value:

```tsx
// inside the component
const insets = useSafeAreaInsets();
// ...
<ScrollView
  className="flex-1 px-5"
  contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
  ...
>
```

Screens to update (replace inline `<SafeAreaView ... edges={['top']}>` with `<ScreenContainer edges="top">` and fix scroll padding):
- `app/(tabs)/today.tsx` — `paddingBottom: 140` → `navAwareBottomPadding(insets.bottom)`.
- `app/(tabs)/entries.tsx` — same; also import `TIMELINE_INDENT` and use it for both the ScrollView gutter and the spine `left` (replace `px-4` magic + `left-[16px]`).
- `app/(tabs)/insights.tsx` — add the missing horizontal padding (the ScrollView at `:249` lacks `px-4` that the inner content at `:252` assumes); use `ScreenContainer padded`.
- `app/(tabs)/explore.tsx` — adopt; (WS7 rebuilds its content).
- `app/(tabs)/settings.tsx` — adopt.

For **chat footer overlap** (`app/chat.tsx`):
- Move `FooterActions` **out of the ScrollView** into a fixed footer pinned above the keyboard/safe area, OR keep it inline but set `contentContainerStyle={{ paddingBottom: 96 }}` and ensure the `InlineTypingInput` + footer have separation. **Preferred:** pin `FooterActions` as a bottom bar inside the `ScreenContainer` (sibling of ScrollView) so the last message never collides. Mirror the structure already used in `app/intentions/chat.tsx` where `IntentionChatFooter` is a sibling of `IntentionChatBody` (not inside the scroll). This is the cleaner, already-proven pattern in the codebase.

For **modal sheets** that hug the nav:
- `app/(tabs)/today.tsx:269-290` "More options" sheet and `app/intentions/detail.tsx` action sheet: add `paddingBottom: insets.bottom + 24` to the sheet container.
- `components/memory-graph/MemoryGraphSheet.tsx`: replace `bottom-28` with a computed `bottom` of `navAwareBottomPadding(insets.bottom)` (or render above nav explicitly).

### 0.4 Define missing tokens (prevents invisible-UI class of bug)

In `tailwind.config.js`, add any color token referenced but undefined. The known offender (`accent-green`, used at `components/today/WeekdaySelector.tsx:55`) is fully handled in **WS8**; if WS8 is sequenced later, add a placeholder `accent-green` here so the badge isn't invisible in the meantime. (Confirm with `grep -rn "accent-" components app` for any other undefined token.)

---

## Files touched

| File | Change |
|---|---|
| `constants/spacing.ts` | **new** — layout constants + `navAwareBottomPadding` |
| `components/ui/ScreenContainer.tsx` | **new** — safe-area + padding wrapper |
| `app/(tabs)/today.tsx` | adopt container, computed bottom padding, fix "More options" sheet inset |
| `app/(tabs)/entries.tsx` | adopt container, `TIMELINE_INDENT` for gutter + spine |
| `app/(tabs)/insights.tsx` | adopt container, add missing horizontal padding |
| `app/(tabs)/explore.tsx` | adopt container |
| `app/(tabs)/settings.tsx` | adopt container |
| `app/chat.tsx` | pin `FooterActions` as fixed footer (no overlap); `edges="all"` |
| `app/intentions/chat.tsx` | `edges="all"` via container (footer already correct) |
| `components/memory-graph/MemoryGraphSheet.tsx` | computed bottom clearance |
| `tailwind.config.js` | ensure no undefined tokens (placeholder `accent-green` if WS8 later) |

> Keep each screen ≤ 500 lines (AGENTS.md). `today.tsx` is ~295 lines — fine. If adopting the container pushes any file over, extract the modal sheet into its own component.

---

## Tests

- `__tests__/components/ScreenContainer.test.tsx` (new): renders children; applies `top,bottom` edges when `edges="all"`, `top` only otherwise; applies `px-5` when `padded`.
- `__tests__/constants/spacing.test.ts` (new): `navAwareBottomPadding(0) === BASE+16`; monotonic in inset.
- Extend `__tests__/screens/TabBottomSpacing.test.ts` (exists, currently modified): assert every tab's ScrollView uses `navAwareBottomPadding`, not a literal `140`.
- Keep `__tests__/components/SpatialView.test.tsx` green.

---

## Acceptance criteria

- Screenshot QA (light + dark) on all 5 tabs: no content under the home indicator; last list item fully visible above the floating nav with a consistent gap.
- Chat: last message + input + footer never overlap; footer pinned, content scrolls behind it cleanly.
- Entries: timeline spine aligns exactly with the date-row gutter at any padding.
- `npm run check:design` passes; no file > 500 lines.
- No undefined Tailwind color tokens (`grep` clean).
