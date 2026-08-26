/**
 * Floating island dock — elevated capsule nav with accent write CTA.
 * Not a full-bleed tab bar: sits inset from edges above the home area.
 *
 * Layout note: equal-width slots use inline `flex: 1` (not NativeWind className).
 * AnimatedPressable often drops className flex, which piles every tab on the left.
 */

import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { useThemeSettings } from '@/hooks/theme/useThemeSettings';
import * as Haptics from 'expo-haptics';
import {
    BookOpen,
    GearSix,
    Graph,
    Lightbulb,
    PencilSimple,
    Sun,
} from 'phosphor-react-native';
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RadialMenu } from './radial-menu';

export type TabName = 'today' | 'explore' | 'entries' | 'insights' | 'settings';

interface BottomNavProps {
    activeTab: TabName;
    onTabPress: (tab: TabName) => void;
    onFabPress?: () => void;
}

type PhosphorIcon = typeof Sun;

interface TabConfig {
    name: TabName;
    icon: PhosphorIcon;
    /** Stable id for tests / analytics (not rendered as Material glyph). */
    iconId: string;
    label: string;
}

/** Canonical tab list (settings lives in headers; dock shows four + write). */
export const tabConfig: TabConfig[] = [
    { name: 'today', icon: Sun, iconId: 'sun', label: 'Today' },
    { name: 'explore', icon: Graph, iconId: 'graph', label: 'Memory' },
    { name: 'insights', icon: Lightbulb, iconId: 'lightbulb', label: 'Insights' },
    { name: 'entries', icon: BookOpen, iconId: 'book-open', label: 'History' },
    { name: 'settings', icon: GearSix, iconId: 'gear', label: 'Settings' },
];

const DOCK_TABS: TabConfig[] = [
    tabConfig[0],
    tabConfig[1],
    tabConfig[2],
    tabConfig[3],
];

const SPRING = { damping: 18, stiffness: 320, mass: 0.7 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Append 2-digit hex alpha when `hex` is #RRGGBB; otherwise return as-is. */
function withAlpha(hex: string, alpha: string): string {
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return `${hex}${alpha}`;
    return hex;
}

function hapticLight() {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function hapticMedium() {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

function hapticHeavy() {
    if (Platform.OS === 'web') return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

function DockTab({
    tab,
    isActive,
    accent,
    inactiveColor,
    onPress,
}: {
    tab: TabConfig;
    isActive: boolean;
    accent: string;
    inactiveColor: string;
    onPress: () => void;
}) {
    const scale = useSharedValue(1);
    const IconComponent = tab.icon;

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        // Outer slot owns flex width. Animated child only scales — never owns flex.
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <AnimatedPressable
                onPress={() => {
                    hapticLight();
                    onPress();
                }}
                onPressIn={() => {
                    scale.value = withSpring(0.9, SPRING);
                }}
                onPressOut={() => {
                    scale.value = withSpring(1, SPRING);
                }}
                accessibilityLabel={tab.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                style={[animStyle, { alignItems: 'center', justifyContent: 'center' }]}
                hitSlop={6}
            >
                <View
                    style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        borderRadius: 16,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderCurve: 'continuous',
                        ...(isActive
                            ? { backgroundColor: withAlpha(accent, '1A') }
                            : null),
                    }}
                >
                    <IconComponent
                        size={22}
                        color={isActive ? accent : inactiveColor}
                        weight={isActive ? 'fill' : 'regular'}
                    />
                    <Text
                        className={`text-[10px] tracking-wide ${
                            isActive
                                ? 'font-bold text-text-light dark:text-white'
                                : 'font-medium text-text-secondary-light dark:text-text-secondary-dark'
                        }`}
                        numberOfLines={1}
                    >
                        {tab.label}
                    </Text>
                </View>
            </AnimatedPressable>
        </View>
    );
}

function WriteButton({
    accent,
    ringColor,
    onPress,
}: {
    accent: string;
    ringColor: string;
    onPress?: () => void;
}) {
    const scale = useSharedValue(1);
    const [radialVisible, setRadialVisible] = useState(false);
    const router = useRouter();

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const longPressGesture = Gesture.LongPress()
        .minDuration(400)
        .onStart(() => {
            hapticHeavy();
            setRadialVisible(true);
        });

    const handleNavigate = (route: string, params?: Record<string, string>) => {
        hapticMedium();
        setRadialVisible(false);
        if (params) {
            router.push({ pathname: route, params });
        } else {
            router.push(route);
        }
    };

    const handleCloseRadial = () => {
        setRadialVisible(false);
    };

    return (
        <GestureDetector gesture={longPressGesture}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <AnimatedPressable
                    onPress={() => {
                        hapticMedium();
                        onPress?.();
                    }}
                    onPressIn={() => {
                        scale.value = withSpring(0.92, SPRING);
                    }}
                    onPressOut={() => {
                        scale.value = withSpring(1, SPRING);
                    }}
                    accessibilityLabel="Write new entry"
                    accessibilityRole="button"
                    style={[
                        animStyle,
                        {
                            width: 56,
                            height: 56,
                            marginTop: -10,
                            borderRadius: 28,
                            backgroundColor: accent,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderCurve: 'continuous',
                            borderWidth: 3,
                            borderColor: ringColor,
                            boxShadow: `0 10px 28px ${withAlpha(accent, '59')}`,
                        },
                    ]}
                >
                    <PencilSimple size={24} color="#FFFFFF" weight="bold" />
                </AnimatedPressable>
                <RadialMenu
                    isVisible={radialVisible}
                    onClose={handleCloseRadial}
                    onNavigate={handleNavigate}
                />
            </View>
        </GestureDetector>
    );
}

export function BottomNav({ activeTab, onTabPress, onFabPress }: BottomNavProps) {
    const insets = useSafeAreaInsets();
    const isDark = useColorScheme() === 'dark';
    const { colorTheme } = useThemeSettings();

    const accent = isDark
        ? colorTheme.colors.accentDark
        : colorTheme.colors.accentLight;
    const inactiveColor = isDark ? '#6B7280' : '#9CA3AF';
    // Ring matches the dock surface so the write button feels "cut through" the pill.
    const writeRing = isDark ? '#1C1C1E' : '#FFFFFF';

    const dockShadow = isDark
        ? '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)'
        : '0 10px 36px rgba(15,23,42,0.12), 0 0 0 1px rgba(15,23,42,0.06)';

    const left = DOCK_TABS.slice(0, 2);
    const right = DOCK_TABS.slice(2, 4);

    const handleTab = useCallback(
        (name: TabName) => {
            onTabPress(name);
        },
        [onTabPress]
    );

    return (
        <View
            pointerEvents="box-none"
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 30,
                paddingHorizontal: 16,
                paddingBottom: Math.max(insets.bottom, 10) + 8,
            }}
        >
            <View
                className="bg-surface-light/95 dark:bg-surface-dark/95"
                style={{
                    width: '100%',
                    height: 68,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: 34,
                    borderCurve: 'continuous',
                    paddingHorizontal: 4,
                    boxShadow: dockShadow,
                }}
            >
                {left.map((tab) => (
                    <DockTab
                        key={tab.name}
                        tab={tab}
                        isActive={activeTab === tab.name}
                        accent={accent}
                        inactiveColor={inactiveColor}
                        onPress={() => handleTab(tab.name)}
                    />
                ))}

                <WriteButton
                    accent={accent}
                    ringColor={writeRing}
                    onPress={onFabPress}
                />

                {right.map((tab) => (
                    <DockTab
                        key={tab.name}
                        tab={tab}
                        isActive={activeTab === tab.name}
                        accent={accent}
                        inactiveColor={inactiveColor}
                        onPress={() => handleTab(tab.name)}
                    />
                ))}
            </View>
        </View>
    );
}
