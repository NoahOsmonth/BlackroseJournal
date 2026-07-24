# Skeleton Loading Redesign

## Summary

Replace every circle spinner (`ActivityIndicator`) in the app with Discord/Facebook-style skeleton loading — shimmering gray placeholders that match the shape of the content being loaded. Content screens get composed skeleton components (paragraph blocks, card shapes, list rows). Buttons, boot screen, and overlays get the existing `LoadingBar` (Discord-style 3-segment wave bars). Zero circles remain.

The app already has a working `Skeleton` primitive (`components/ui/Skeleton.tsx`) and two composed skeletons (`HistorySkeleton`, `InsightsSkeleton`). This plan extends that pattern to 11 new composed/inline skeletons and swaps all remaining spinners.

### What stays unchanged
- **TypingIndicator** (chat AI thinking) — already non-circle (3 bouncing dots), conventional chat pattern.
- **HistorySkeleton / InsightsSkeleton** — already skeleton-based.
- **LoadingBar in FooterActions** (finish-entry button) — already non-circle.

### Design decisions

| Decision | Rationale |
|---|---|
| **SkeletonText helper** | Reduces boilerplate for paragraph text skeletons (N lines of same height, last line shorter). Used by 6+ composed skeletons. |
| **SkeletonProvider shared animation** | Each `Skeleton` instance currently creates its own `withRepeat` animation timer. With 8–12 blocks per screen, that's 8–12 native timers. Provider reduces to 1 shared timer via React Context. Backward-compat fallback means zero risk — skeletons animate fine without it. |
| **React.memo on Skeleton** | Prevents spurious re-renders when parent state changes during loading (e.g., `feedbackValue` in entry-reflection). |
| **useReducedMotion** | Accessibility: 4 other components in the codebase already respect `ReduceMotion.System`. Skeleton should too — renders static gray blocks when enabled. |
| **Composed skeletons in feature dirs** | Matches existing `HistorySkeleton`/`InsightsSkeleton` pattern. Each file is a dead-simple JSX composition that a developer can match to its real content at a glance. |
| **LoadingBar for buttons/boot/overlay** | Not content placeholders — these are action feedback or processing overlays. LoadingBar is the established non-circle indicator (already used in finish-entry button). |
| **Boot screen → LoadingBar** | `global.css` is imported at module level in `_layout.tsx`, so NativeWind classes are available from first render. LoadingBar works here. |

---

## Phase 1 — Foundation (shared infrastructure)

### Step 1: Extract shared Reanimated test mock
**New file:** `__tests__/mocks/reanimatedMock.ts`

Extract the inline Reanimated mock (currently duplicated in `Skeleton.test.tsx`, `LoadingBar.test.tsx`, `HistoryWeekRhythm.test.tsx`) into a shared helper. Add `useReducedMotion: () => false` to the mock (needed after Step 4). Export a `mockReanimated()` function that returns the mock object.

### Step 2: Create SkeletonText helper
**New file:** `components/ui/SkeletonText.tsx` (~30 lines)

Renders N `Skeleton` blocks in a `gap-2` View — all same height, last line shorter. Eliminates the most repetitive boilerplate (paragraphs of text lines).

```
interface SkeletonTextProps {
    lines: number;
    lineClassName?: string;       // default 'h-4'
    lastLineClassName?: string;   // default 'w-2/3'
    className?: string;           // wrapper, default 'gap-2'
    accessibilityLabel?: string;  // default 'Loading'
}
```

**Test:** `__tests__/components/SkeletonText.test.tsx` — verify line count, default label, last-line width class, custom className. Uses shared mock from Step 1.

### Step 3: Create SkeletonProvider
**New file:** `components/ui/SkeletonProvider.tsx` (~50 lines)

Creates a React Context holding a single `SharedValue<number>`. The provider starts one `withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }))` animation. Calls `useReducedMotion()` — when true, skips starting the animation (shared value stays at 0, skeletons render as static gray blocks). Exports `SkeletonProvider` and `useSkeletonProgress()` hook.

### Step 4: Refactor Skeleton.tsx for shared animation + memo + reduce-motion
**Modify:** `components/ui/Skeleton.tsx`

- Call `useContext(SkeletonAnimationContext)` — if a shared progress value exists, use it and skip creating a local `withRepeat`/`withTiming`. If null (standalone/tests), fall back to the current local animation (backward compat).
- Call `useReducedMotion()` — when true, render a plain `<View>` with `bg-divider-light/80 dark:bg-divider-dark/80` and no `Animated.View` child (no animation).
- Wrap in `React.memo` with a custom comparator checking `className`, `durationMs`, `accessibilityLabel`.
- Same props interface — no breaking changes.
- `durationMs` only applies in fallback mode; document in prop comment.

### Step 5: Mount SkeletonProvider in app root
**Modify:** `app/_layout.tsx`

Import `SkeletonProvider` and wrap the app tree inside `GestureHandlerRootView` (line 103), outside `AppColorThemeProvider`. This ensures every screen/modal has the shared animation.

### Step 6: Tests for foundation
- Update `__tests__/components/Skeleton.test.tsx` — use shared mock, add test for reduce-motion static rendering, add test for React.memo preventing re-renders, add test for context fallback (renders without provider).
- **New file:** `__tests__/components/SkeletonProvider.test.tsx` — verify provider creates shared value, renders children, skips animation when useReducedMotion is true (mock it).
- Update `__tests__/components/LoadingBar.test.tsx` — use shared mock, add `useReducedMotion` to mock.

### Dependencies
Steps 1→2 (SkeletonText test uses shared mock). Steps 3→4 (Skeleton consumes provider context). Steps 3→5 (mount provider). Steps 4→6 (Skeleton tests). Step 2 is independent of 3–5.

---

## Phase 2 — Post-finish flow (primary complaint, highest priority)

The user said: "when I finish entry the loading should not be circle." The finish-entry button already uses `LoadingBar` (non-circle). The circles are the **entry-reflection screen** and **streak-haiku screen**, shown immediately after finishing.

### Step 7: Create EntryReflectionSkeleton
**New file:** `components/entries/EntryReflectionSkeleton.tsx` (~40 lines)

Mirrors the three content sections in `app/entry-reflection.tsx:127-213`:
- **Reflection card**: `SkeletonText lines={4}` inside `p-5 rounded-2xl bg-surface-light dark:bg-surface-dark` card + a divider + two small circle Skeletons (feedback thumbs placeholder).
- **Key insight**: label Skeleton (`h-3 w-24`) + card with `SkeletonText lines={3}`.
- **Suggestions CTA**: card with title Skeleton (`h-4 w-32`) + subtitle Skeleton (`h-3 w-48`) + chevron block.

Root: `<View className="gap-4" accessibilityLabel="Loading reflection">`.

**Test:** `__tests__/components/EntryReflectionSkeleton.test.tsx` — verify accessibility label, card count.

### Step 8: Swap loading in entry-reflection.tsx
**Modify:** `app/entry-reflection.tsx`

- Replace lines 105–112 (`isLoading && <View className="items-center py-10">…ActivityIndicator…</View>`) with `{isLoading && <EntryReflectionSkeleton />}`.
- Remove `ActivityIndicator` from the `react-native` import (line 15 — only usage).
- Keep `useThemeColor`/`primaryColor` (still used for feedback icons at lines 150, 166).
- Add `import { EntryReflectionSkeleton } from '@/components/entries/EntryReflectionSkeleton'`.

### Step 9: Create StreakHaikuSkeleton
**New file:** `components/streak/StreakHaikuSkeleton.tsx` (~20 lines)

Mirrors the haiku card from `app/streak-haiku.tsx:65-108`:
- "Your haiku" label Skeleton (`h-5 w-28`) + `SkeletonText lines={3} lineClassName="h-5"` for the 3-line haiku.
- Inside the card wrapper (`p-6 rounded-2xl bg-surface-light dark:bg-surface-dark`).

Root: `<View accessibilityLabel="Loading haiku">`.

**Test:** `__tests__/components/StreakHaikuSkeleton.test.tsx`.

### Step 10: Swap loading in streak-haiku.tsx
**Modify:** `app/streak-haiku.tsx`

- Replace lines 66–73 (`isLoading && <View className="items-center">…ActivityIndicator…</View>`) with `{isLoading && <StreakHaikuSkeleton />}`.
- Remove `ActivityIndicator` from import (line 12 — only usage).
- Verify `primaryColor`/`useThemeColor` — if only used for the spinner, remove. Check with `tsc --noEmit`.

### Step 11: Tests for Phase 2
Both skeleton test files from Steps 7 and 9. Verify accessibility labels, block counts, `gap-*` usage (no `space-*`).

### Dependencies
Steps 7→8 (create then swap). Steps 9→10 (create then swap). Step 11 depends on 7 and 9. Phase 2 depends on Phase 1 (SkeletonText + Skeleton provider).

---

## Phase 3 — Content screens (parallelizable)

Each step creates a composed skeleton + swaps the spinner. All are independent of each other.

### Step 12: EntryDetailSkeleton for entry-detail.tsx
**New file:** `components/entries/EntryDetailSkeleton.tsx` (~35 lines)

Mirrors `app/entry-detail.tsx:104-122`: analysis panel skeleton (label + `SkeletonText lines={2}` for insight + label + `SkeletonText lines={2}` for quote + mood Skeleton + 3 topic pill Skeletons `h-6 w-16 rounded-full`) + 2–3 chat message bubble skeletons (`h-16 w-3/4 rounded-2xl`, alternating left/right).

Swap in `app/entry-detail.tsx:95-102`. Remove `ActivityIndicator` import.

### Step 13: SuggestionsSkeleton for suggestions.tsx
**New file:** `components/entries/SuggestionsSkeleton.tsx` (~30 lines)

Mirrors `app/suggestions.tsx:109-151`: 3 HABIT suggestion cards. Each card: badge Skeleton (`h-5 w-14 rounded-lg`) + button Skeleton (`h-9 w-24 rounded-xl`) in a flex-row, then `SkeletonText lines={2}` below. All inside `p-5 rounded-2xl bg-surface-light dark:bg-surface-dark` cards in a `gap-3` container.

Swap in `app/suggestions.tsx:81-88`. Remove `ActivityIndicator` import.

### Step 14: PersonaGenerateSkeleton for persona/generate.tsx
**New file:** `components/personas/PersonaGenerateSkeleton.tsx` (~30 lines)

Mirrors `app/persona/generate.tsx:71-83`: avatar circle Skeleton (`h-20 w-20 rounded-full`) + name field (label `h-3 w-16` + input `h-12 w-full rounded-xl`) + tagline field + voice selector + prompt textarea (`h-24 w-full rounded-xl`). Wrapped in `ScreenContainer`.

Swap in `app/persona/generate.tsx:55-68`. Remove `ActivityIndicator` import.

### Step 15: IntentionFormSkeleton for intentions/edit.tsx
**New file:** `components/intentions/IntentionFormSkeleton.tsx` (~25 lines)

Mirrors `app/intentions/edit.tsx:63-74`: title field (label + input) + description field (label + textarea) + area selector (label + pill-shaped Skeleton).

Swap in `app/intentions/edit.tsx:38-48`. Remove `ActivityIndicator` import.

### Step 16: MemoryHubSkeleton for MemoryHubScreen.tsx
**New file:** `components/memory/MemoryHubSkeleton.tsx` (~35 lines)

Mirrors `components/memory/MemoryHubScreen.tsx:210-301`: portrait card (`h-32 w-full rounded-2xl`) with title + theme pills inside + 3–4 atom row skeletons (each: dot `h-2.5 w-2.5 rounded-full` + title `h-4 w-32` + layer label `h-3 w-16`).

`MemoryHubScreen.tsx` is 367 lines — extracting the skeleton keeps it from approaching the 450 warning threshold.

Swap in `components/memory/MemoryHubScreen.tsx:203-206`. Remove `ActivityIndicator` import.

### Step 17: Tests for Phase 3 skeletons
One test file per new skeleton (5 files). Each verifies accessibility label, block count, `gap-*` usage. All use the shared Reanimated mock from Step 1.

### Dependencies
All Phase 3 steps depend on Phase 1 (SkeletonText, Skeleton provider). Steps 12–16 are independent of each other and can be parallelized. Step 17 depends on all of 12–16.

---

## Phase 4 — Inline component skeletons (co-located, no new files)

These are small skeletons placed directly within existing components that have their own loading state.

### Step 18: Inline skeleton in EntryAnalysisPanel.tsx
**Modify:** `components/entries/EntryAnalysisPanel.tsx`

Replace lines 11–18 ("Generating analysis..." text card) with inline `Skeleton` + `SkeletonText` blocks mirroring the real analysis layout at lines 24–67: "Analysis" label Skeleton + "Insight" label + `SkeletonText lines={2}` + "Quote" label + `SkeletonText lines={2}` + "Mood & Topics" label + mood Skeleton + 3 topic pill Skeletons. Import `Skeleton` and `SkeletonText`.

**Update test:** `__tests__/components/EntryAnalysisPanel.test.tsx` — add test for `isLoading` state rendering skeleton blocks.

### Step 19: Inline skeleton in MemoryGraphSourceCard.tsx
**Modify:** `components/memory-graph/MemoryGraphSourceCard.tsx`

Replace lines 25–35 ("Loading source…" spinner + text) with: label Skeleton (`h-3 w-16`) + title `SkeletonText lines={2} lineClassName="h-4"` + meta Skeleton (`h-3 w-32`) + snippet `SkeletonText lines={2} lineClassName="h-3"`. Keep existing card wrapper. Remove `ActivityIndicator` import (only usage).

### Step 20: Inline skeleton in MemoryGraphSheet.tsx (glance insight)
**Modify:** `components/memory-graph/MemoryGraphSheet.tsx`

Replace lines 202–208 ("Writing a short insight…" spinner + text) with `<SkeletonText lines={2} lineClassName="h-4" className="mt-3" accessibilityLabel="Writing insight" />`. Keep the "At a glance" label visible above it.

**Keep** `ActivityIndicator` import — still used at line 280 for the "Deepen with AI" button (handled in Phase 5).

### Step 21: Inline skeleton in ChatModelPickerSheet.tsx (model list)
**Modify:** `components/ai/ChatModelPickerSheet.tsx`

Replace lines 180–186 ("Loading models…" spinner + text) with 3–4 inline model row skeletons: each row = name Skeleton (`h-4 w-32`) + description Skeleton (`h-3 w-48`) inside a card-shaped wrapper. Use a small `ModelRowSkeleton` sub-component within the same file (~10 lines, only used here).

**Keep** `ActivityIndicator` import — still used at line 146 for the refresh button (handled in Phase 5).

### Step 22: Update existing tests for Phase 4 components
- Check `__tests__/components/` for existing tests on MemoryGraphSourceCard, MemoryGraphSheet, ChatModelPickerSheet — update any that assert ActivityIndicator presence.
- Verify skeleton rendering with `getByLabelText`.

### Dependencies
All Phase 4 steps depend on Phase 1 (SkeletonText). Steps 18–21 are independent of each other. Step 22 depends on 18–21.

---

## Phase 5 — Button / boot / overlay → LoadingBar (eliminate remaining circles)

These are not content placeholders — they're action feedback or processing overlays. Swap to the existing `LoadingBar` (Discord-style wave bars).

### Step 23: Boot screen in _layout.tsx
**Modify:** `app/_layout.tsx:94-99`

Replace `<ActivityIndicator size="large" color={textColor} />` + `<Text>Loading...</Text>` with `<LoadingBar size="md" accessibilityLabel="Loading app" />`. Keep the inline-styled container `View` (NativeWind classes are available since `global.css` is imported at module level). Add `import { LoadingBar } from '@/components/ui/LoadingBar'`. Remove `ActivityIndicator` from import.

### Step 24: WebView overlay in MemoryGraphScreen.tsx
**Modify:** `components/memory-graph/MemoryGraphScreen.tsx:78-82`

Replace `<ActivityIndicator color={tint} />` absolute overlay with `<LoadingBar size="md" accessibilityLabel="Loading graph" />`. Keep the `absolute inset-0 items-center justify-center` positioning. Remove `ActivityIndicator` import (only usage).

### Step 25: "Deepen with AI" button in MemoryGraphSheet.tsx
**Modify:** `components/memory-graph/MemoryGraphSheet.tsx:280`

Replace `<ActivityIndicator color="#111827" />` with `<LoadingBar size="sm" />`. Now that both ActivityIndicator usages in this file are replaced (glance in Step 20, button here), remove `ActivityIndicator` import entirely.

### Step 26: Refresh button in ChatModelPickerSheet.tsx
**Modify:** `components/ai/ChatModelPickerSheet.tsx:146`

Replace `<ActivityIndicator size="small" color={iconColor} />` with `<LoadingBar size="sm" />`. Now that both ActivityIndicator usages in this file are replaced (list in Step 21, refresh here), remove `ActivityIndicator` import entirely.

### Step 27: "Working..." button in CustomModelSettingsSection.tsx
**Modify:** `components/settings/CustomModelSettingsSection.tsx:53-54`

Replace the `'Working...'` button label text with `<LoadingBar size="sm" />` when `busy`. Keep the normal label text unchanged. Import `LoadingBar`.

### Dependencies
Phase 5 steps are independent of each other. They depend on Phase 1 only indirectly (LoadingBar already exists, no dependency on new infrastructure). Can run in parallel with Phases 3–4.

---

## Phase 6 — Verification

### Step 28: Run all gates
```bash
npx tsc --noEmit          # catches unused imports (ActivityIndicator removal)
npm run lint              # catches unused vars, import ordering
npm run check:design      # confirms no file exceeds 500 lines
npm test                  # all tests including guard tests
```

Specifically verify these guard tests pass:
- `__tests__/no-space-utilities.test.ts` — no `space-y-*`/`space-x-*` in new skeletons
- `__tests__/dark-mode-contrast.test.ts` — no banned patterns introduced
- `__tests__/tailwind-config.test.ts` — all color tokens valid
- `__tests__/components/Skeleton.test.tsx` — primitive still works
- `__tests__/components/LoadingBar.test.tsx` — LoadingBar still works

### Step 29: Visual QA
- Light mode + dark mode on each modified screen
- Verify skeleton blocks match the shape/proportions of the real content
- Verify shimmer animation is smooth (not janky)
- Verify reduce-motion renders static gray blocks (no animation)

### Step 30: Update PROGRESS.md
Document all changes, new files, and follow-ups.

---

## New files summary

| File | Phase | Lines (est.) |
|---|---|---|
| `__tests__/mocks/reanimatedMock.ts` | 1 | ~25 |
| `components/ui/SkeletonText.tsx` | 1 | ~30 |
| `components/ui/SkeletonProvider.tsx` | 1 | ~50 |
| `components/entries/EntryReflectionSkeleton.tsx` | 2 | ~40 |
| `components/streak/StreakHaikuSkeleton.tsx` | 2 | ~20 |
| `components/entries/EntryDetailSkeleton.tsx` | 3 | ~35 |
| `components/entries/SuggestionsSkeleton.tsx` | 3 | ~30 |
| `components/personas/PersonaGenerateSkeleton.tsx` | 3 | ~30 |
| `components/intentions/IntentionFormSkeleton.tsx` | 3 | ~25 |
| `components/memory/MemoryHubSkeleton.tsx` | 3 | ~35 |
| 7 test files (one per composed skeleton + SkeletonText + SkeletonProvider) | various | ~30 each |

**Modified files:** 14 files (11 spinner swap sites + Skeleton.tsx + _layout.tsx + test mock updates)

---

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| **Generic SkeletonScreen wrapper** (config-driven skeleton that takes a layout spec) | Over-engineering. Each skeleton is 20–40 lines of readable JSX. A config abstraction adds indirection without reducing line count. The existing HistorySkeleton/InsightsSkeleton pattern (direct composition) is proven and simpler. |
| **Leave button-loading as ActivityIndicator** | User explicitly said "all the loading here should not be circle." LoadingBar is the established non-circle button indicator (already in FooterActions). Size="sm" fits button contexts. |
| **Leave boot screen as ActivityIndicator** | Same user request — no circles. LoadingBar works here because NativeWind CSS is processed at build time, available from first render. Risk is minimal. |
| **Skeleton for WebView overlay (MemoryGraphScreen)** | The overlay sits on top of a live WebView rendering a dynamic graph. A content-shaped skeleton can't meaningfully mimic graph nodes. LoadingBar is the right semantic — it's a processing indicator, not a content placeholder. |
| **Per-instance animation stagger** | All skeleton blocks sweeping in sync is the correct Discord/Facebook visual behavior. Stagger adds complexity (useDerivedValue per instance) for no visual benefit. If ever needed, composed skeletons can add per-instance offsets consuming the same shared driver. |
| **Skip SkeletonProvider (just use per-instance animations)** | The existing HistorySkeleton runs 12 timers without reported issues. However, adding skeletons to 10+ more screens means more simultaneous timers. The Provider is ~50 lines with a backward-compat fallback — low risk, right architecture from the start. If the team prefers to skip it, all composed skeletons work fine without it (fallback path). |

---

## Risk mitigations

| Risk | Mitigation |
|---|---|
| Removing `ActivityIndicator` import breaks files with two usages (MemoryGraphSheet, ChatModelPickerSheet) | These files are handled in two steps each (Phase 4 + Phase 5). Remove import only after both usages are replaced. Verify with `tsc --noEmit`. |
| `useThemeColor`/`primaryColor` become unused after swap | After each swap, run `tsc --noEmit` and `npm run lint`. Remove unused imports only if confirmed unused across the entire file. |
| Skeleton layout drift when real content changes | Each skeleton file has a header comment referencing the exact screen file and line numbers it mirrors. Skeletons are simple JSX — updates take seconds. |
| Reanimated mock missing `useReducedMotion` in new test files | Shared mock from Step 1 includes `useReducedMotion: () => false`. All new test files import it. |
| NativeWind classes not ready during boot screen | `global.css` is imported at module level in `_layout.tsx`. NativeWind v4 processes CSS at build time. Classes are available from first render. |
| `check:design` 500-line limit | All new skeleton files are 20–40 lines. Largest modified file is MemoryHubScreen at 367 lines (skeleton extracted, not inlined). No file approaches 500. |
| New `components/streak/` and `components/personas/` directories | These match the feature-directory convention. `components/streak/` is for the streak-haiku skeleton; `components/personas/` for the persona generation skeleton. Both are co-located with their feature logic. |
