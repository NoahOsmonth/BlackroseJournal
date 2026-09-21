/**
 * Spacing & layout constants.
 * Single source of truth for screen padding, bottom-nav clearance, and the
 * history timeline indent. Use these instead of magic numbers so a change in
 * one place propagates everywhere (prevents the timeline-spine drift bug).
 */
export const SCREEN_PADDING_X = 24;          // px — standard horizontal gutter (matches the concept's 24pt)
export const HISTORY_PADDING_X = 24;         // px — entries timeline gutter / Today ScrollView
export const TIMELINE_INDENT = HISTORY_PADDING_X; // spine must match the gutter
// Flat hairline dock (BottomNav): 6px top pad + 48px control row + max(inset, 8)
// bottom pad. Measured 63px at 390x844 with a zero inset — 64 keeps a pixel of
// slack. (Was 96, which was the old island capsule and left a visible dead band
// above the dock on anything pinned to the bottom.)
export const BOTTOM_NAV_BASE_HEIGHT = 64;    // px — BottomNav content height excluding safe-area inset
export const CONTENT_BOTTOM_GAP = 16;        // px — breathing room above the nav

/** Bottom padding a scroll view needs to clear the floating BottomNav. */
export function navAwareBottomPadding(insetBottom: number): number {
    return BOTTOM_NAV_BASE_HEIGHT + insetBottom + CONTENT_BOTTOM_GAP;
}
