# Task: Implement Emoji Settings

## Problem
Users want to customize the "design sticker" (emoji style) used in the Emotional Landscape chart.

## Impact
Personalization requirement from the user is not met.

## Proposed Fix
Add an "Emoji Style" setting and use it in the Insights chart.

### Logic
1.  **Storage:** Update `useThemeSettings.ts` (or create `useEmojiSettings.ts`) to store `emojiStyle` (e.g., 'native', '3d', 'flat').
2.  **Settings UI:** Add a section in `app/(tabs)/settings.tsx` to select the style.
3.  **Visualization:** Update `EmotionalLandscapeChart.tsx` to render different emojis based on the selected style.
    -   Since we don't have external assets, we can simulate styles:
        -   `native`: Standard text emoji.
        -   `highlight`: Emoji with a colored background/glow.
        -   `grayscale`: Emoji with `grayscale` filter (if possible) or opacity changes.
        -   *Alternative:* If the user meant "custom images", we can map emotions to specific `Image` assets if we had them. For now, "Native" vs "Styled Container" is a safe MVP.

## Acceptance Criteria
-   Settings screen shows "Emoji Style" option.
-   Selection persists across app restarts.
-   Insights chart updates immediately upon change.

## Verification
-   `npm test __tests__/hooks/useThemeSettings.test.ts`
-   Verify UI update flow.
