/**
 * Blackrose dock — flat hairline bar with four text tabs and a compact write
 * control. Not an island capsule, not a giant center FAB (plan §2/§4).
 *
 * Layout note: equal-width slots use inline `flex: 1` (not NativeWind className).
 * AnimatedPressable often drops className flex, which piles every tab on the left.
 *
 * Tab ids stay `today | explore | entries | insights | settings` so routes and
 * deep links are untouched; only the labels change (Today · Threads · Insights ·
 * Archive). Settings lives in the header gear, not the dock.
 */

import { useColorScheme } from '@/hooks/theme/use-color-scheme';
import { useThemeSettings } from '@/hooks/theme/useThemeSettings';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
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

type TabIcon = keyof typeof MaterialIcons.glyphMap;

interface TabConfig {
    name: TabName;
    icon: TabIcon;
    /** Stable id for tests / analytics (not rendered as Material glyph). */
    iconId: string;
    label: string;
}

/** Canonical tab list (settings lives in headers; dock shows four + write). */
export const tabConfig: TabConfig[] = [
    { name: 'today', icon: 'calendar-today', iconId: 'sun', label: 'Today' },
    { name: 'explore', icon: 'notes', iconId: 'graph', label: 'Threads' },
    { name: 'insights', icon: 'graphic-eq', iconId: 'lightbulb', label: 'Insights' },
    { name: 'entries', icon: 'inventory-2', iconId: 'book-open', label: 'Archive' },
    { name: 'settings', icon: 'settings', iconId: 'gear', label: 'Settings' },
];

const DOCK_TABS: TabConfig[] = [
    tabConfig[0],
    tabConfig[1],
    tabConfig[2],
    tabConfig[3],
];

const SPRING = { damping: 18, stiffness: 320, mass: 0.7 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

/**
 * A dock tab is a label, not an icon: the concept reads as a text row with the
 * active item in full ink. The glyph is decorative and stays subordinate.
 */
function DockTab({
    tab,
    isActive,
    accent,
    onPress,
}: {
    tab: TabConfig;
    isActive: boolean;
    accent: string;
    onPress: () => void;
}) {
    const scale = useSharedValue(1);

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
                    scale.value = withSpring(0.94, SPRING);
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
                        gap: 3,
                        paddingVertical: 6,
                    }}
                >
                    <MaterialIcons
                        name={tab.icon}
                        size={18}
                        color={accent}
                        style={{ opacity: isActive ? 1 : 0.45 }}
                    />
                    <Text
                        className={
                            isActive
                                ? 'text-[11px] tracking-wide text-text-light dark:text-text-dark'
                                : 'text-[11px] tracking-wide text-text-secondary-light dark:text-text-secondary-dark'
                        }
                        numberOfLines={1}
                    >
                        {tab.label}
                    </Text>
                </View>
            </AnimatedPressable>
        </View>
    );
}

/**
 * Compact write control: a solid bone square with a dark pencil, matching the
 * dock in black-rose-archive.png. Deliberately not a giant floating circle —
 * write is one affordance among the tabs, not a brand button.
 */
function WriteButton({
    onPress,
}: {
    onPress?: () => void;
}) {
    const scale = useSharedValue(1);
    const [radialVisible, setRadialVisible] = useState(false);
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';

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

    // Concept dock: solid bone square with the pencil knocked out in the
    // surface colour (dark pencil on light fill in both schemes).
    const fillColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const pencilColor = isDark ? BLACKROSE_PALETTE.dark.surface : BLACKROSE_PALETTE.light.surface;

    return (
        <GestureDetector gesture={longPressGesture}>
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingLeft: 4 }}>
                <AnimatedPressable
                    onPress={() => {
                        hapticMedium();
                        onPress?.();
                    }}
                    onPressIn={() => {
                        scale.value = withSpring(0.94, SPRING);
                    }}
                    onPressOut={() => {
                        scale.value = withSpring(1, SPRING);
                    }}
                    accessibilityLabel="Write new entry"
                    accessibilityRole="button"
                    style={[animStyle]}
                >
                    <View
                        className="w-11 h-11 rounded-control items-center justify-center"
                        style={{ backgroundColor: fillColor }}
                    >
                        <MaterialIcons name="edit" size={20} color={pencilColor} />
                    </View>
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

    const handleTab = useCallback(
        (name: TabName) => {
            onTabPress(name);
        },
        [onTabPress]
    );

    return (
        <View
            pointerEvents="box-none"
            className="bg-surface-light/95 dark:bg-background-dark/95 border-t border-hairline-light dark:border-hairline-dark"
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 30,
                paddingHorizontal: 16,
                paddingBottom: Math.max(insets.bottom, 8),
                paddingTop: 6,
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            {DOCK_TABS.map((tab) => (
                <DockTab
                    key={tab.name}
                    tab={tab}
                    isActive={activeTab === tab.name}
                    accent={accent}
                    onPress={() => handleTab(tab.name)}
                />
            ))}

            <WriteButton onPress={onFabPress} />
        </View>
    );
}
