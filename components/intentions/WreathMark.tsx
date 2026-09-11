/**
 * WreathMark — the thorned-circle ornament from `black-rose-intention-detail.png`.
 *
 * A stroked ring with evenly spaced thorn ticks and two inner leaves, used as
 * the intention card's mark in place of the old photographic hero band. Colour
 * is passed by the caller so the SVG stays a pure presentational primitive.
 */

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

const CENTER = 24;
const RING_RADIUS = 15;
const THORN_COUNT = 18;
const THORN_INNER = 13.4;
const THORN_OUTER = 17.2;

function thornPath(index: number): string {
    const angle = (360 / THORN_COUNT) * index;
    // A thorn is a short radial tick; drawing both ends lets the ring read as
    // bramble rather than a dashed circle.
    const rad = (angle * Math.PI) / 180;
    const x1 = CENTER + Math.cos(rad) * THORN_INNER;
    const y1 = CENTER + Math.sin(rad) * THORN_INNER;
    const x2 = CENTER + Math.cos(rad) * THORN_OUTER;
    const y2 = CENTER + Math.sin(rad) * THORN_OUTER;
    return `M${x1.toFixed(2)},${y1.toFixed(2)}L${x2.toFixed(2)},${y2.toFixed(2)}`;
}

interface WreathMarkProps {
    readonly size?: number;
    readonly color: string;
    readonly strokeWidth?: number;
}

export function WreathMark({ size = 64, color, strokeWidth = 1.2 }: WreathMarkProps) {
    return (
        <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
            <Circle cx={CENTER} cy={CENTER} r={RING_RADIUS} stroke={color} strokeWidth={strokeWidth} />
            {Array.from({ length: THORN_COUNT }, (_, index) => (
                <Path
                    key={index}
                    d={thornPath(index)}
                    stroke={color}
                    strokeWidth={strokeWidth * 0.8}
                    strokeLinecap="round"
                />
            ))}
            {/* Two leaves curling inward from the lower half of the ring. */}
            <Path
                d="M20 33c-3.2-.6-5-2.8-5.2-5.6 3.1.5 5 2.7 5.2 5.6Z"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <Path
                d="M28 33c3.2-.6 5-2.8 5.2-5.6-3.1.5-5 2.7-5.2 5.6Z"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    );
}
