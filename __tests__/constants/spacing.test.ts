import {
    BOTTOM_NAV_BASE_HEIGHT,
    CONTENT_BOTTOM_GAP,
    HISTORY_PADDING_X,
    navAwareBottomPadding,
    SCREEN_PADDING_X,
    TIMELINE_INDENT,
} from '@/constants/spacing';

describe('spacing constants', () => {
    it('exposes a stable spacing scale', () => {
        expect(SCREEN_PADDING_X).toBe(20);
        expect(HISTORY_PADDING_X).toBe(16);
        // The timeline spine must share the exact gutter so they never drift apart.
        expect(TIMELINE_INDENT).toBe(HISTORY_PADDING_X);
    });

    it('clears the floating bottom nav including the safe-area inset', () => {
        expect(navAwareBottomPadding(0)).toBe(BOTTOM_NAV_BASE_HEIGHT + CONTENT_BOTTOM_GAP);
        expect(navAwareBottomPadding(34)).toBe(BOTTOM_NAV_BASE_HEIGHT + 34 + CONTENT_BOTTOM_GAP);
    });

    it('is monotonic in the bottom inset', () => {
        expect(navAwareBottomPadding(20)).toBeGreaterThan(navAwareBottomPadding(0));
        expect(navAwareBottomPadding(48)).toBeGreaterThan(navAwareBottomPadding(20));
    });
});
