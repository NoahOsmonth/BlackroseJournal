import {
    derivePartnerHex,
    hexToHsl,
    hexToRgb,
    hslToHex,
    hslToRgb,
    rgbToHex,
    rgbToHsl,
    softenNeutralPartner,
} from '../../../services/theme/colorDerivation';

describe('hex <-> RGB conversions', () => {
    it('parses 6-digit hex including lowercase and a bare hash', () => {
        expect(hexToRgb('#1E3A8A')).toEqual({ r: 30, g: 58, b: 138 });
        expect(hexToRgb('1e3a8a')).toEqual({ r: 30, g: 58, b: 138 });
    });

    it('returns null for unparseable or unsupported-length input', () => {
        expect(hexToRgb('nope')).toBeNull();
        expect(hexToRgb('#FFF')).toBeNull();
        expect(hexToRgb('')).toBeNull();
    });

    it('formats RGB back to canonical uppercase hex', () => {
        expect(rgbToHex({ r: 30, g: 58, b: 138 })).toBe('#1E3A8A');
    });

    it('clamps and rounds out-of-range channels', () => {
        expect(rgbToHex({ r: 300, g: -5, b: 128 })).toBe('#FF0080');
        expect(rgbToHex({ r: 10.4, g: 0, b: 0 })).toBe('#0A0000');
    });
});

describe('HSL conversions', () => {
    it('converts pure red to hue 0, full saturation, mid lightness', () => {
        expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('converts black and white with zero saturation', () => {
        expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
        expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
    });

    it('clamps saturation and lightness on the way back to RGB', () => {
        expect(hslToRgb({ h: 0, s: 200, l: 120 })).toEqual(hslToRgb({ h: 0, s: 100, l: 100 }));
        expect(hslToRgb({ h: 0, s: -50, l: -10 })).toEqual(hslToRgb({ h: 0, s: 0, l: 0 }));
    });

    it('wraps hues outside 0-360', () => {
        expect(hslToHex({ h: 400, s: 100, l: 50 })).toBe(hslToHex({ h: 40, s: 100, l: 50 }));
        expect(hslToHex({ h: -20, s: 100, l: 50 })).toBe(hslToHex({ h: 340, s: 100, l: 50 }));
    });

    it('round-trips hex -> HSL -> hex within two RGB channels of the source', () => {
        // Integer-percent HSL rounding can shift a channel by ~2 units; the
        // pipeline is for deriving partners, not lossless color archiving.
        for (const hex of ['#1E3A8A', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#000000', '#FFFFFF']) {
            const hsl = hexToHsl(hex);
            expect(hsl).not.toBeNull();
            const roundTripped = hexToRgb(hslToHex(hsl!))!;
            const original = hexToRgb(hex)!;
            expect(Math.abs(roundTripped.r - original.r)).toBeLessThanOrEqual(2);
            expect(Math.abs(roundTripped.g - original.g)).toBeLessThanOrEqual(2);
            expect(Math.abs(roundTripped.b - original.b)).toBeLessThanOrEqual(2);
        }
    });
});

describe('derivePartnerHex', () => {
    it('derives the dark-mode partner at lightness 70 preserving hue and saturation', () => {
        const source = '#1E3A8A';
        const sourceHsl = hexToHsl(source)!;
        const partner = derivePartnerHex(source, true)!;
        const partnerHsl = hexToHsl(partner)!;

        expect(Math.abs(partnerHsl.h - sourceHsl.h)).toBeLessThanOrEqual(1);
        expect(Math.abs(partnerHsl.s - sourceHsl.s)).toBeLessThanOrEqual(1);
        expect(partnerHsl.l).toBe(70);
    });

    it('derives the light-mode partner at lightness 38 when the dark slot was edited', () => {
        const source = '#1E3A8A';
        const sourceHsl = hexToHsl(source)!;
        const partner = derivePartnerHex(source, false)!;
        const partnerHsl = hexToHsl(partner)!;

        expect(Math.abs(partnerHsl.h - sourceHsl.h)).toBeLessThanOrEqual(1);
        expect(Math.abs(partnerHsl.s - sourceHsl.s)).toBeLessThanOrEqual(1);
        expect(partnerHsl.l).toBe(38);
    });

    it('returns null for an invalid source color', () => {
        expect(derivePartnerHex('not-a-color', true)).toBeNull();
    });
});

describe('softenNeutralPartner', () => {
    it('passes through saturated sources unchanged', () => {
        expect(softenNeutralPartner('#1E3A8A', '#888888')).toBe('#888888');
    });

    it('softens near-monochrome sources instead of returning a stark gray', () => {
        const partner = softenNeutralPartner('#AAAAAA', '#FFFFFF');
        const partnerHsl = hexToHsl(partner)!;

        expect(partner).not.toBe('#FFFFFF');
        expect(partnerHsl.s).toBeGreaterThan(0);
        // Partner lightness sits between the source (67%) and the stark white partner.
        expect(partnerHsl.l).toBeGreaterThan(67);
        expect(partnerHsl.l).toBeLessThan(100);
    });

    it('passes through when either color is unparseable', () => {
        expect(softenNeutralPartner('#AAAAAA', 'garbage')).toBe('garbage');
        expect(softenNeutralPartner('garbage', '#FFFFFF')).toBe('#FFFFFF');
    });
});
