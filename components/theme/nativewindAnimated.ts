/**
 * Reanimated ↔ NativeWind bridge.
 *
 * NativeWind (react-native-css-interop) registers `className` interop for plain
 * RN components only — `Animated.View`, `Animated.ScrollView` and friends from
 * `react-native-reanimated` are NOT in that table. Passing `className` to them
 * is therefore silently ignored: the element keeps whatever its `style` says,
 * which showed up as 0-height skeletons, missing gutters and unstyled scroll
 * containers that looked fine in tests but were invisible in the browser.
 *
 * Registering the mapping here makes `className` on those components behave
 * exactly like it does on `View` / `ScrollView`, including `contentContainerClassName`
 * on the scroll containers (the reason the tab gutters live in
 * `contentContainerStyle` today, and now also work as a class).
 *
 * Import this once, before the first render, from anywhere near the app root.
 * `cssInterop` is idempotent per component, so a duplicate import is harmless.
 */
import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';

cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });
cssInterop(Animated.Image, { className: 'style' });
cssInterop(Animated.ScrollView, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
});
cssInterop(Animated.FlatList, {
    className: 'style',
    contentContainerClassName: 'contentContainerStyle',
});

export {};
