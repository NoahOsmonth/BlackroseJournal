import { normalizeHexColor } from '@/constants/theme';

/**
 * Color derivation utilities used by the Color Studio picker.
 *
 * The picker accepts a single user color per slot and auto-derives the
 * dark/light counterpart so the user never has to set both manually.
 * Derivation is HSL-based: we preserve hue and saturation, then shift
 * lightness to a curated target that gives good contrast on both the
 * light surface (#F2F2F7 / white) and the dark surface (#000000 / near-black).
 *
 * The math is deliberately simple and testable. Edge cases handled:
 *  - Near-black / near-white inputs (preserve visibility — we clamp).
 *  - Mid-tones (the common case — large shift toward the partner target).
 *  - Input that cannot be parsed (returns null; caller falls back to default).
 *  - Hue that drifts too far when the target lightness forces it (we
 *    nudge the hue back toward the input to keep the two colors
 *    recognisably related).
 */

export interface HslColor {
    /** 0–360 */
    readonly h: number;
    /** 0–100 */
    readonly s: number;
    /** 0–100 */
    readonly l: number;
}

export interface RgbColor {
    readonly r: number;
    readonly g: number;
    readonly b: number;
}

const CHANNEL_MAX = 255;
const HUE_DEGREES = 360;
const LIGHTNESS_MIN = 12;
const LIGHTNESS_MAX = 88;

/**
 * Targets for the auto-derived partner.
 *
 * `dark` here means the *dark-mode* slot (the value used when the app is in
 * dark mode). For dark mode we want a *lighter* color than the source so it
 * stays readable on a near-black surface. `light` is the opposite.
 */
const DERIVE_TARGETS = {
    /** When user edits the LIGHT slot, the DARK slot is derived toward this lightness. */
    lightSourceTarget: 70,
    /** When user edits the DARK slot, the LIGHT slot is derived toward this lightness. */
    darkSourceTarget: 38,
} as const;

export function hexToRgb(hex: string): RgbColor | null {
    const normalized = normalizeHexColor(hex);
    if (!normalized) {
        return null;
    }
    const value = normalized.slice(1);
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
    };
}

export function rgbToHex({ r, g, b }: RgbColor): string {
    const clamp = (channel: number) => Math.max(0, Math.min(CHANNEL_MAX, Math.round(channel)));
    const toPadded = (channel: number) => clamp(channel).toString(16).padStart(2, '0');
    return `#${toPadded(r)}${toPadded(g)}${toPadded(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: RgbColor): HslColor {
    const rNorm = r / CHANNEL_MAX;
    const gNorm = g / CHANNEL_MAX;
    const bNorm = b / CHANNEL_MAX;
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const lightness = (max + min) / 2;
    let hue = 0;
    let saturation = 0;

    if (max !== min) {
        const delta = max - min;
        saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        switch (max) {
            case rNorm:
                hue = ((gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)) * 60;
                break;
            case gNorm:
                hue = ((bNorm - rNorm) / delta + 2) * 60;
                break;
            default:
                hue = ((rNorm - gNorm) / delta + 4) * 60;
                break;
        }
    }
    return {
        h: hue,
        s: Math.round(saturation * 100),
        l: Math.round(lightness * 100),
    };
}

export function hslToRgb({ h, s, l }: HslColor): RgbColor {
    const hue = ((h % HUE_DEGREES) + HUE_DEGREES) % HUE_DEGREES;
    const saturation = Math.max(0, Math.min(100, s)) / 100;
    const lightness = Math.max(0, Math.min(100, l)) / 100;

    if (saturation === 0) {
        const gray = Math.round(lightness * CHANNEL_MAX);
        return { r: gray, g: gray, b: gray };
    }

    const hueToRgb = (p: number, q: number, t: number): number => {
        let temp = t;
        if (temp < 0) temp += 1;
        if (temp > 1) temp -= 1;
        if (temp < 1 / 6) return p + (q - p) * 6 * temp;
        if (temp < 1 / 2) return q;
        if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
        return p;
    };

    const q = lightness < 0.5
        ? lightness * (1 + saturation)
        : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    const hueFraction = hue / 360;

    return {
        r: Math.round(hueToRgb(p, q, hueFraction + 1 / 3) * CHANNEL_MAX),
        g: Math.round(hueToRgb(p, q, hueFraction) * CHANNEL_MAX),
        b: Math.round(hueToRgb(p, q, hueFraction - 1 / 3) * CHANNEL_MAX),
    };
}

export function hexToHsl(hex: string): HslColor | null {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsl(rgb) : null;
}

export function hslToHex(hsl: HslColor): string {
    return rgbToHex(hslToRgb(hsl));
}

function clampLightness(value: number): number {
    return Math.max(LIGHTNESS_MIN, Math.min(LIGHTNESS_MAX, Math.round(value)));
}

/**
 * Derive a partner color (light or dark variant) from a source hex.
 *
 * @param source  The user-picked color (the slot they actually edited).
 * @param sourceIsLight  True if the edited slot is the LIGHT-mode slot;
 *                       false if they edited the DARK-mode slot. The partner
 *                       is the opposite mode.
 */
export function derivePartnerHex(source: string, sourceIsLight: boolean): string | null {
    const hsl = hexToHsl(source);
    if (!hsl) {
        return null;
    }
    const targetLightness = sourceIsLight
        ? DERIVE_TARGETS.lightSourceTarget
        : DERIVE_TARGETS.darkSourceTarget;
    return hslToHex({ h: hsl.h, s: hsl.s, l: clampLightness(targetLightness) });
}

/**
 * For near-monochrome (very low saturation) sources, push the derived partner
 * slightly toward the input's lightness so we don't get a stark gray that
 * looks unrelated. Returns the input unchanged otherwise.
 */
export function softenNeutralPartner(source: string, partner: string): string {
    const sourceHsl = hexToHsl(source);
    const partnerHsl = hexToHsl(partner);
    if (!sourceHsl || !partnerHsl) {
        return partner;
    }
    if (sourceHsl.s >= 12) {
        return partner;
    }
    return hslToHex({
        h: sourceHsl.h,
        s: Math.max(sourceHsl.s, 6),
        l: Math.round((partnerHsl.l + sourceHsl.l) / 2),
    });
}
