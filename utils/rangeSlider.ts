import { TintColors } from '@/constants/theme';

/** Full control height — ≥44px mobile hit target. */
export const RANGE_SLIDER_HIT_HEIGHT = 48;
/**
 * Visual thumb diameter (circle). Compact disc centered on the groove —
 * large enough to see/grab, not a tall vertical capsule.
 */
export const RANGE_SLIDER_THUMB_SIZE = 16;
/** Alias kept for callers that read width (circle ⇒ same as diameter). */
export const RANGE_SLIDER_THUMB_WIDTH = RANGE_SLIDER_THUMB_SIZE;
/** Thin groove, not a fat pill. */
export const RANGE_SLIDER_GROOVE_HEIGHT = 2;
export const RANGE_SLIDER_TICK_MINOR_H = 5;
export const RANGE_SLIDER_TICK_MAJOR_H = 9;
/** Snappy, non-bouncy motion (instrument, not jelly). */
export const RANGE_SLIDER_SNAP_MS = 70;

export interface RangeSliderTickMark {
    readonly ratio: number;
    readonly major: boolean;
    readonly value: number;
}

export interface RangeSliderInstrumentPalette {
    groove: string;
    grooveEdge: string;
    range: string;
    tickMinor: string;
    tickMajor: string;
    /** Solid disc fill (accent). */
    thumbBody: string;
    /** Thin same-family edge ring (not black). */
    thumbEdge: string;
    thumbEdgeHover: string;
}

function stepDecimals(step: number): number {
    const text = String(step);
    const dot = text.indexOf('.');
    return dot === -1 ? 0 : text.length - dot - 1;
}

export function roundToStep(value: number, step: number, min: number, max: number): number {
    if (max <= min) return min;
    const decimals = stepDecimals(step);
    const raw = Math.round((value - min) / step) * step + min;
    const clamped = Math.min(Math.max(raw, min), max);
    return Number(clamped.toFixed(decimals));
}

export function valueToRatio(value: number, min: number, max: number): number {
    const range = max - min;
    if (range <= 0) return 0;
    return Math.min(Math.max((value - min) / range, 0), 1);
}

export function buildRangeSliderTicks(
    min: number,
    max: number,
    step: number
): RangeSliderTickMark[] {
    if (max <= min || step <= 0) {
        return [{ ratio: 0, major: true, value: min }];
    }
    const count = Math.round((max - min) / step);
    const majorEvery =
        count <= 4 ? 1 : count <= 10 ? 2 : count <= 20 ? 5 : Math.max(5, Math.round(count / 4));
    const decimals = stepDecimals(step);
    const ticks: RangeSliderTickMark[] = [];
    for (let i = 0; i <= count; i++) {
        const value = Number((min + i * step).toFixed(decimals));
        const ratio = (value - min) / (max - min);
        const major = i === 0 || i === count || i % majorEvery === 0;
        ticks.push({ ratio, major, value });
    }
    return ticks;
}

export function rangeSliderInstrumentPalette(isDark: boolean): RangeSliderInstrumentPalette {
    const accent = isDark ? TintColors.dark : TintColors.light;
    // Darker amber ring for definition — same family, never pure black outline.
    const accentEdge = isDark ? '#E08A20' : '#D97706';
    const accentEdgeHover = isDark ? '#F5D08A' : '#B45309';
    if (isDark) {
        return {
            groove: '#2C2C2E',
            grooveEdge: 'rgba(255,255,255,0.08)',
            range: accent,
            tickMinor: 'rgba(255,255,255,0.14)',
            tickMajor: 'rgba(255,255,255,0.32)',
            thumbBody: accent,
            thumbEdge: accentEdge,
            thumbEdgeHover: accentEdgeHover,
        };
    }
    return {
        groove: '#C7C7CC',
        grooveEdge: 'rgba(0,0,0,0.08)',
        range: accent,
        tickMinor: 'rgba(0,0,0,0.12)',
        tickMajor: 'rgba(0,0,0,0.28)',
        thumbBody: accent,
        thumbEdge: accentEdge,
        thumbEdgeHover: accentEdgeHover,
    };
}
