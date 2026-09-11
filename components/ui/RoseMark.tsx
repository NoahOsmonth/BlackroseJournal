/**
 * RoseMark — the Blackrose line silhouette.
 *
 * The mark is a stroked rose rosette: three rings of rounded petals spiralling
 * into a tight eye, optionally on a stem with two leaves. It is deliberately a
 * *line* mark, not a photographic hero — the plan caps daily screens to one quiet
 * serif moment plus a mark, and bans full-bleed rose imagery there.
 *
 * `bloom` is the header/empty-state mark; `sprig` adds the stem and leaves used
 * by Threads, chat and persona chrome, matching the concept PNGs.
 *
 * Petals are generated from one canonical rounded-petal path and rotated, so the
 * silhouette reads as a flower rather than concentric circles. Colour is passed
 * in by the caller so this stays a pure presentational primitive (Svg needs a
 * hex, not a NativeWind class).
 */

import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

const CENTER = 12;

/** A rounded petal of `length`, pointing up from the centre, in a 24x24 box. */
function petalPath(length: number): string {
    const baseY = CENTER - length * 0.16;
    const tipY = CENTER - length;
    const ctrlDip = CENTER - length * 0.42;
    const ctrlOuter = CENTER - length * 1.02;
    const halfWidth = length * 0.58;

    return (
        `M${CENTER},${baseY}` +
        `C${CENTER - halfWidth},${ctrlDip} ${CENTER - halfWidth * 0.86},${ctrlOuter} ${CENTER},${tipY}` +
        `C${CENTER + halfWidth * 0.86},${ctrlOuter} ${CENTER + halfWidth},${ctrlDip} ${CENTER},${baseY}Z`
    );
}

/** One ring of petals: `count` petals evenly rotated, offset by `offsetDeg`. */
function PetalRing({
    count,
    length,
    offsetDeg,
    color,
    strokeWidth,
}: {
    count: number;
    length: number;
    offsetDeg: number;
    color: string;
    strokeWidth: number;
}) {
    const path = petalPath(length);
    return (
        <>
            {Array.from({ length: count }, (_, index) => {
                const angle = offsetDeg + (360 / count) * index;
                return (
                    <G key={`${count}-${offsetDeg}-${index}`} transform={`rotate(${angle} ${CENTER} ${CENTER})`}>
                        <Path
                            d={path}
                            stroke={color}
                            strokeWidth={strokeWidth}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    </G>
                );
            })}
        </>
    );
}

interface RoseMarkProps {
    readonly size?: number;
    /** Stroke color — use a scheme-aware token from `BLACKROSE_PALETTE`. */
    readonly color: string;
    readonly strokeWidth?: number;
    /** `bloom` is the rosette alone; `sprig` adds a stem with two leaves. */
    readonly variant?: 'bloom' | 'sprig';
}

export function RoseMark({
    size = 24,
    color,
    strokeWidth = 1.4,
    variant = 'sprig',
}: RoseMarkProps) {
    const isSprig = variant === 'sprig';
    const rosetteScale = isSprig ? 0.76 : 1;

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <G
                transform={
                    isSprig
                        ? `translate(${CENTER} ${CENTER - 2.2}) scale(${rosetteScale}) translate(${-CENTER} ${-CENTER})`
                        : undefined
                }
            >
                <PetalRing count={5} length={9.6} offsetDeg={0} color={color} strokeWidth={strokeWidth} />
                <PetalRing count={5} length={6.9} offsetDeg={36} color={color} strokeWidth={strokeWidth} />
                <PetalRing count={5} length={4.1} offsetDeg={0} color={color} strokeWidth={strokeWidth} />
                <Circle cx={CENTER} cy={CENTER - 0.4} r={1.15} stroke={color} strokeWidth={strokeWidth} />
            </G>

            {isSprig ? (
                <>
                    <Path
                        d="M12 14.4v7.4"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                    <Path
                        d="M12 17.4c-1.5.2-2.8-.7-3.2-2.2 1.5-.3 2.9.6 3.2 2.2Z"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <Path
                        d="M12 19.6c1.5.2 2.8-.7 3.2-2.2-1.5-.3-2.9.6-3.2 2.2Z"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </>
            ) : null}
        </Svg>
    );
}
