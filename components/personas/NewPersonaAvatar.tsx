import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { G, Path, Rect } from 'react-native-svg';

import { Colors, PersonaColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TILE_POSITIONS = [
    [-8, -8],
    [8, -8],
    [24, -8],
    [40, -8],
    [56, -8],
    [72, -8],
    [88, -8],
    [0, 8],
    [16, 8],
    [32, 8],
    [48, 8],
    [64, 8],
    [80, 8],
    [-8, 24],
    [8, 24],
    [24, 24],
    [40, 24],
    [56, 24],
    [72, 24],
    [88, 24],
    [0, 40],
    [16, 40],
    [32, 40],
    [48, 40],
    [64, 40],
    [80, 40],
    [-8, 56],
    [8, 56],
    [24, 56],
    [40, 56],
    [56, 56],
    [72, 56],
    [88, 56],
    [0, 72],
    [16, 72],
    [32, 72],
    [48, 72],
    [64, 72],
    [80, 72],
] as const;

interface PatternTileProps {
    readonly x: number;
    readonly y: number;
}

function PatternTile({ x, y }: PatternTileProps) {
    return (
        <G transform={`translate(${x} ${y})`}>
            <Path d="M8 0L16 4V12L8 16L0 12V4Z" fill={PersonaColors.tealDark} />
            <Path d="M8 0L16 4L8 8L0 4Z" fill={PersonaColors.tealLight} />
            <Path d="M8 8L16 4V12L8 16Z" fill={PersonaColors.tealShadow} opacity={0.45} />
        </G>
    );
}

export function NewPersonaAvatar() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const iconColor = isDark ? Colors.dark.text : Colors.light.surface;

    return (
        <View
            testID="new-persona-avatar"
            className="w-24 h-24 rounded-full items-center justify-center bg-persona-teal overflow-hidden shadow-lg"
        >
            <Svg width={96} height={96} viewBox="0 0 96 96">
                <Rect width={96} height={96} fill={PersonaColors.tealBase} />
                <G opacity={0.9}>
                    {TILE_POSITIONS.map(([x, y]) => (
                        <PatternTile key={`${x}-${y}`} x={x} y={y} />
                    ))}
                </G>
            </Svg>
            <View className="absolute inset-0 items-center justify-center">
                <MaterialIcons name="add" size={36} color={iconColor} />
            </View>
        </View>
    );
}
