import { BookOpen, Graph, Lightbulb, PencilSimple } from 'phosphor-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    ReduceMotion,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

type RadialIcon = typeof PencilSimple;

interface RadialOption {
    label: string;
    icon: RadialIcon;
    route: string;
    params?: Record<string, string>;
}

interface RadialMenuProps {
    isVisible: boolean;
    onClose: () => void;
    onNavigate: (route: string, params?: Record<string, string>) => void;
}

interface RadialMenuItemProps {
    delay: number;
    isVisible: boolean;
    onNavigate: RadialMenuProps['onNavigate'];
    option: RadialOption;
    x: number;
    y: number;
}

const RADIAL_OPTIONS: RadialOption[] = [
    { label: 'New Entry', icon: PencilSimple, route: '/chat', params: { mode: 'new' } },
    { label: 'New Check-in', icon: BookOpen, route: '/intentions/select' },
    { label: 'Ask Rosebud', icon: Lightbulb, route: '/ask-rosebud' },
    { label: 'Memory', icon: Graph, route: '/memory-graph' },
];

const RADIAL_SPRING = {
    damping: 22,
    stiffness: 280,
    mass: 0.8,
    reduceMotion: ReduceMotion.System,
};
const ITEM_SPRING = {
    damping: 20,
    stiffness: 300,
    mass: 0.7,
    reduceMotion: ReduceMotion.System,
};
const TIMING = { duration: 200, reduceMotion: ReduceMotion.System };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function RadialMenuItem({
    delay,
    isVisible,
    onNavigate,
    option,
    x,
    y,
}: RadialMenuItemProps) {
    const scale = useSharedValue(0);
    const opacity = useSharedValue(0);
    const IconComponent = option.icon;

    React.useEffect(() => {
        if (isVisible) {
            scale.value = withDelay(delay, withSpring(1, ITEM_SPRING));
            opacity.value = withDelay(delay, withTiming(1, TIMING));
            return;
        }

        scale.value = withSpring(0, ITEM_SPRING);
        opacity.value = withTiming(0, TIMING);
    }, [delay, isVisible, opacity, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateX: x },
            { translateY: y },
            { scale: scale.value },
        ] as const,
    }));

    return (
        <AnimatedPressable
            onPress={() => onNavigate(option.route, option.params)}
            style={[animatedStyle, styles.radialItem]}
            accessibilityLabel={option.label}
            hitSlop={12}
        >
            <View style={styles.radialItemInner}>
                <IconComponent size={24} color="#FFFFFF" weight="bold" />
                <Text style={styles.radialLabel}>{option.label}</Text>
            </View>
        </AnimatedPressable>
    );
}

export function RadialMenu({ isVisible, onClose, onNavigate }: RadialMenuProps) {
    const menuScale = useSharedValue(0);
    const menuOpacity = useSharedValue(0);
    const backdropOpacity = useSharedValue(0);

    React.useEffect(() => {
        if (isVisible) {
            menuScale.value = withSpring(1, RADIAL_SPRING);
            menuOpacity.value = withTiming(1, TIMING);
            backdropOpacity.value = withTiming(0.4, TIMING);
            return;
        }

        menuScale.value = withSpring(0, RADIAL_SPRING);
        menuOpacity.value = withTiming(0, TIMING);
        backdropOpacity.value = withTiming(0, TIMING);
        const timeout = setTimeout(onClose, 200);
        return () => clearTimeout(timeout);
    }, [backdropOpacity, isVisible, menuOpacity, menuScale, onClose]);

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));
    const menuStyle = useAnimatedStyle(() => ({
        opacity: menuOpacity.value,
        transform: [{ scale: menuScale.value }],
    }));

    const radius = 100;
    const startAngle = -Math.PI / 2;
    const angleStep = (Math.PI * 1.5) / (RADIAL_OPTIONS.length - 1);

    return (
        <Animated.View
            style={[StyleSheet.absoluteFillObject, styles.backdrop, backdropStyle]}
            pointerEvents={isVisible ? 'auto' : 'none'}
        >
            <Pressable
                onPress={onClose}
                style={StyleSheet.absoluteFillObject}
                accessibilityLabel="Close menu"
            />
            <Animated.View style={[styles.menu, menuStyle]} pointerEvents="box-none">
                {RADIAL_OPTIONS.map((option, index) => {
                    const angle = startAngle + angleStep * index;
                    return (
                        <RadialMenuItem
                            key={option.label}
                            delay={index * 50}
                            isVisible={isVisible}
                            onNavigate={onNavigate}
                            option={option}
                            x={Math.cos(angle) * radius}
                            y={Math.sin(angle) * radius}
                        />
                    );
                })}
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    menu: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
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
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    },
    radialLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
