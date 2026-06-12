import {
    COLOR_THEME_PRESETS,
    DEFAULT_COLOR_THEME,
    QUICK_PICK_COLORS,
    getColorThemeSlotPartner,
    isColorThemeLightSlot,
    normalizeHexColor,
    updateColorThemeSlot,
} from '../../constants/theme';
import {
    derivePartnerHex,
    hexToHsl,
    hexToRgb,
    hslToHex,
    hslToRgb,
    rgbToHex,
    rgbToHsl,
    softenNeutralPartner,
} from '../../services/theme/colorDerivation';

describe('colorDerivation', () => {
    describe('hex / rgb', () => {
        it('parses a 6-digit hex to rgb', () => {
            expect(hexToRgb('#FF9F0A')).toEqual({ r: 255, g: 159, b: 10 });
        });

        it('returns null for invalid hex', () => {
            expect(hexToRgb('not-a-color')).toBeNull();
        });

        it('round-trips rgb through hex', () => {
            expect(rgbToHex({ r: 18, g: 52, b: 86 })).toBe('#123456');
        });

        it('clamps rgb values when serialising', () => {
            expect(rgbToHex({ r: -5, g: 300, b: 128 })).toBe('#00FF80');
        });
    });

    describe('rgb / hsl', () => {
        it('converts a red color to hsl(0, 100, 50)', () => {
            expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
        });

        it('treats greys as having zero saturation', () => {
            expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, l: 50 });
        });

        it('round-trips rgb through hsl', () => {
            const input = { r: 18, g: 52, b: 86 };
            const hsl = rgbToHsl(input);
            const back = hslToRgb(hsl);
            // HSL conversion rounds integer channels in both directions, so
            // the round-trip can drift by up to ~2 on some inputs.
            expect(Math.abs(back.r - input.r)).toBeLessThanOrEqual(2);
            expect(Math.abs(back.g - input.g)).toBeLessThanOrEqual(2);
            expect(Math.abs(back.b - input.b)).toBeLessThanOrEqual(2);
        });

        it('normalises hue to 0–360 when converting', () => {
            const out = hslToRgb({ h: 720, s: 50, l: 50 });
            const ref = hslToRgb({ h: 0, s: 50, l: 50 });
            expect(out).toEqual(ref);
        });
    });

    describe('hexToHsl / hslToHex', () => {
        it('parses and serialises through the same hex value', () => {
            const hex = '#FF9F0A';
            const hsl = hexToHsl(hex);
            expect(hsl).not.toBeNull();
            expect(hslToHex(hsl ?? { h: 0, s: 0, l: 0 })).toBe(hex);
        });

        it('returns null for unparseable input', () => {
            expect(hexToHsl('zzz')).toBeNull();
        });
    });

    describe('derivePartnerHex', () => {
        it('derives a lighter dark variant from a dark light source', () => {
            const source = '#0EA5E9'; // sky
            const partner = derivePartnerHex(source, true);
            expect(partner).not.toBeNull();
            const partnerHsl = hexToHsl(partner ?? '#000000');
            expect(partnerHsl?.l ?? 0).toBeGreaterThan(50);
        });

        it('derives a darker light variant from a light dark source', () => {
            const source = '#67E8F9'; // light cyan (used as a "dark" slot)
            const partner = derivePartnerHex(source, false);
            expect(partner).not.toBeNull();
            const partnerHsl = hexToHsl(partner ?? '#000000');
            expect(partnerHsl?.l ?? 100).toBeLessThan(50);
        });

        it('preserves hue between source and derived partner', () => {
            const source = '#7C3AED'; // violet
            const partner = derivePartnerHex(source, true);
            const sourceHsl = hexToHsl(source);
            const partnerHsl = hexToHsl(partner ?? '#000000');
            expect(sourceHsl).not.toBeNull();
            expect(partnerHsl).not.toBeNull();
            // Hue is preserved (within rounding tolerance) so the two
            // colors stay recognisably related.
            const hueDelta = Math.abs((sourceHsl?.h ?? 0) - (partnerHsl?.h ?? 0));
            expect(Math.min(hueDelta, 360 - hueDelta)).toBeLessThan(2);
        });

        it('returns null when the source cannot be parsed', () => {
            expect(derivePartnerHex('garbage', true)).toBeNull();
        });

        it('clamps the partner lightness into a visible range', () => {
            // Pure black has nowhere to go darker, but the partner should
            // not collapse to black (lightness > LIGHTNESS_MIN).
            const partner = derivePartnerHex('#000000', false);
            expect(partner).not.toBeNull();
            const partnerHsl = hexToHsl(partner ?? '#000000');
            expect(partnerHsl?.l ?? 0).toBeGreaterThan(10);
        });
    });

    describe('softenNeutralPartner', () => {
        it('is a no-op for saturated colors', () => {
            const source = '#7C3AED';
            const partner = '#C4B5FD';
            expect(softenNeutralPartner(source, partner)).toBe(partner);
        });

        it('nudges a near-grey partner toward the source lightness', () => {
            // A near-grey source + a far-from-source lightness partner
            // should be pulled toward the source's lightness (averaged).
            const source = '#555555';     // L ≈ 33
            const partner = '#EEEEEE';    // L ≈ 93
            const softened = softenNeutralPartner(source, partner);
            const sourceHsl = hexToHsl(source);
            const softenedHsl = hexToHsl(softened);
            // Softened lightness should be strictly between source and partner,
            // i.e. lower than the original partner's lightness.
            const partnerHsl = hexToHsl(partner);
            expect(softenedHsl?.l ?? 0).toBeLessThan(partnerHsl?.l ?? 100);
            expect(softenedHsl?.l ?? 0).toBeGreaterThan(sourceHsl?.l ?? 0);
        });
    });
});

describe('color theme presets', () => {
    it('exposes 8 built-in palettes plus a custom slot', () => {
        expect(COLOR_THEME_PRESETS).toHaveLength(8);
        const ids = COLOR_THEME_PRESETS.map((p) => p.presetId);
        expect(ids).toEqual([
            'rosebud', 'ocean', 'forest', 'plum',
            'sunset', 'lavender', 'mint', 'mocha',
        ]);
    });

    it('every preset has valid 6-digit hex colors for every slot', () => {
        const slots: Array<keyof typeof DEFAULT_COLOR_THEME.colors> = [
            'accentLight', 'accentDark', 'appTextLight', 'appTextDark',
            'secondaryTextLight', 'secondaryTextDark',
            'chatUserTextLight', 'chatUserTextDark',
            'chatAiTextLight', 'chatAiTextDark',
        ];
        for (const preset of COLOR_THEME_PRESETS) {
            for (const slot of slots) {
                const value = preset.colors[slot];
                expect(normalizeHexColor(value)).toBe(value);
            }
        }
    });

    it('updateColorThemeSlot flags the theme as custom', () => {
        const next = updateColorThemeSlot(DEFAULT_COLOR_THEME, 'accentLight', '#445566');
        expect(next?.presetId).toBe('custom');
        expect(next?.colors.accentLight).toBe('#445566');
    });
});

describe('color theme slot helpers', () => {
    it('pairs light/dark slots', () => {
        expect(getColorThemeSlotPartner('accentLight')).toBe('accentDark');
        expect(getColorThemeSlotPartner('accentDark')).toBe('accentLight');
        expect(getColorThemeSlotPartner('appTextLight')).toBe('appTextDark');
    });

    it('detects light slot side', () => {
        expect(isColorThemeLightSlot('accentLight')).toBe(true);
        expect(isColorThemeLightSlot('accentDark')).toBe(false);
    });
});

describe('quick-pick palette', () => {
    it('has 16 curated colors', () => {
        expect(QUICK_PICK_COLORS).toHaveLength(16);
    });

    it('every quick-pick color is a valid 6-digit hex', () => {
        for (const color of QUICK_PICK_COLORS) {
            expect(normalizeHexColor(color)).toBe(color);
        }
    });
});
