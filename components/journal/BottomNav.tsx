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
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withDelay,
    withTiming,
    ReduceMotion,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

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

const RADIAL_SPRING = { damping: 22, stiffness: 280, mass: 0.8 };

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

interface RadialOption {
    label: string;
    icon: React.ComponentType<any>;
    route: string;
    params?: Record<string, string>;
}

const RADIAL_OPTIONS: RadialOption[] = [
    { label: 'New Entry', icon: PencilSimple, route: '/chat', params: { mode: 'new' } },
    { label: 'New Check-in', icon: BookOpen, route: '/intentions/select' },
    { label: 'Ask Rosebud', icon: Lightbulb, route: '/ask-rosebud' },
    { label: 'Memory', icon: Graph, route: '/memory-graph' },
];

function RadialMenu({
    isVisible,
    onClose,
    accent,
    onNavigate,
}: {
    isVisible: boolean;
    onClose: () => void;
    accent: string;
    onNavigate: (route: string, params?: Record<string, string>) => void;
}) {
    const menuScale = useSharedValue(0);
    const menuOpacity = useSharedValue(0);
    const backdropOpacity = useSharedValue(0);
    const itemScales = RADIAL_OPTIONS.map(() => useSharedValue(0));
    const itemOpacities = RADIAL_OPTIONS.map(() => useSharedValue(0));

    const TIMING = { duration: 200, reduceMotion: ReduceMotion.System };
    const ITEM_SPRING = { damping: 20, stiffness: 300, mass: 0.7, reduceMotion: ReduceMotion.System };

    React.useEffect(() => {
        if (isVisible) {
            menuScale.value = withSpring(1, RADIAL_SPRING);
            menuOpacity.value = withTiming(1, TIMING);
            backdropOpacity.value = withTiming(0.4, TIMING);
            RADIAL_OPTIONS.forEach((_, index) => {
                const delay = index * 50;
                itemScales[index].value = withDelay(delay, withSpring(1, ITEM_SPRING));
                itemOpacities[index].value = withDelay(delay, withTiming(1, TIMING));
            });
        } else {
            menuScale.value = withSpring(0, RADIAL_SPRING);
            menuOpacity.value = withTiming(0, TIMING);
            backdropOpacity.value = withTiming(0, TIMING);
            RADIAL_OPTIONS.forEach((_, index) => {
                itemScales[index].value = withSpring(0, ITEM_SPRING);
                itemOpacities[index].value = withTiming(0, TIMING);
            });
            const timeout = setTimeout(onClose, 200);
            return () => clearTimeout(timeout);
        }
    }, [isVisible, onClose]);

    const centerSize = 64;
    const radius = 100;
    const startAngle = -Math.PI / 2;
    const angleStep = (Math.PI * 1.5) / (RADIAL_OPTIONS.length - 1);

    return (
        <Animated.View
            style={{
                ...StyleSheet.absoluteFillObject,
                opacity: backdropOpacity.value,
                backgroundColor: 'rgba(0,0,0,0.4)',
            }}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject} accessibilityLabel="Close menu" />
            <Animated.View
                style={{
                    position: 'absolute',
                    bottom: 80,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ scale: menuScale.value }],
                    opacity: menuOpacity.value,
                }}
                pointerEvents="box-none"
            >
                {RADIAL_OPTIONS.map((option, index) => {
                    const angle = startAngle + angleStep * index;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const IconComponent = option.icon;

                    const itemStyle = useAnimatedStyle(() => ({
                        transform: [
                            { translateX: x } as any,
                            { translateY: y } as any,
                            { scale: itemScales[index].value } as any,
                        ],
                        opacity: itemOpacities[index].value,
                    }));

                    return (
                        <AnimatedPressable
                            key={option.label}
                            onPress={() => {
                                hapticMedium();
                                onNavigate(option.route, option.params);
                            }}
                            style={[itemStyle, styles.radialItem]}
                            accessibilityLabel={option.label}
                            hitSlop={12}
                        >
                            <View style={styles.radialItemInner}>
                                <IconComponent size={24} color="#FFFFFF" weight="bold" />
                                <Text style={styles.radialLabel}>{option.label}</Text>
                            </View>
                        </AnimatedPressable>
                    );
                })}
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    radialItem: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    radialItemInner: {
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.8)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        shadowOpacity: 0.3,
        elevation: 8,
    },
    radialLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

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
                    accent={accent}
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
