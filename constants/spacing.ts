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
