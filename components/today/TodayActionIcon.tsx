import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Colors, TintColors, TodayIconColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface TodayActionIconProps {
    size?: number;
}

export function MorningIntentionIcon({ size = 56 }: TodayActionIconProps) {
    const isDark = useColorScheme() === 'dark';
    const sky = isDark ? Colors.dark.surface : TodayIconColors.morningSkyLight;
    const ray = isDark ? TintColors.dark : TintColors.light;
    const hill = isDark ? TodayIconColors.morningHillDark : TodayIconColors.morningHillLight;

    return (
        <Svg testID="morning-intention-svg" width={size} height={size} viewBox="0 0 56 56">
            <Circle cx="28" cy="28" r="27" fill={sky} />
            <Path d="M14 34c5-9 23-9 28 0v7H14z" fill={hill} />
            <Circle cx="28" cy="26" r="8" fill={ray} />
            <Path
                d="M28 10v6M28 36v6M12 26h6M38 26h6M17 15l4 4M35 33l4 4M39 15l-4 4M21 33l-4 4"
                stroke={ray}
                strokeLinecap="round"
                strokeWidth="3"
            />
            <Path
                d="M21 29c3 3 11 3 14 0"
                stroke={isDark ? Colors.dark.text : TodayIconColors.morningSmileLight}
                strokeLinecap="round"
                strokeWidth="2"
            />
        </Svg>
    );
}

export function EveningReflectionIcon({ size = 56 }: TodayActionIconProps) {
    const isDark = useColorScheme() === 'dark';
    const sky = isDark ? Colors.dark.surface : TodayIconColors.eveningSkyLight;
    const moon = isDark ? TodayIconColors.eveningMoonDark : TodayIconColors.eveningMoonLight;
    const water = isDark ? TodayIconColors.eveningWaterLineLight : TodayIconColors.eveningWaterLight;
    const line = isDark ? TodayIconColors.eveningWaterLineDark : TodayIconColors.eveningWaterLineLight;
    const star = isDark ? Colors.dark.text : TodayIconColors.eveningStarLight;

    return (
        <Svg testID="evening-reflection-svg" width={size} height={size} viewBox="0 0 56 56">
            <Circle cx="28" cy="28" r="27" fill={sky} />
            <Path d="M14 35c7 4 21 4 28 0v8H14z" fill={water} />
            <Path d="M31 12a10 10 0 1 0 10 14A12 12 0 0 1 31 12z" fill={moon} />
            <Rect x="18" y="38" width="20" height="2" rx="1" fill={line} />
            <Rect x="22" y="43" width="12" height="2" rx="1" fill={line} />
            <Circle cx="18" cy="17" r="2" fill={star} />
            <Circle cx="42" cy="30" r="1.5" fill={star} />
        </Svg>
    );
}
