import fs from 'fs';
import path from 'path';

/**
 * Animated + NativeWind interop guard.
 *
 * react-native-css-interop registers `className` handling for plain RN
 * components only. Reanimated's `Animated.View` / `Animated.ScrollView` are not
 * in that table, so a `className` on them is dropped with no warning — the
 * element renders with zero height, no padding and no background. That already
 * shipped once: every `Skeleton` line collapsed to 0px and the tab gutters
 * disappeared on web while Jest stayed green.
 *
 * `components/theme/nativewindAnimated.ts` registers the mapping; the app root
 * must import it before the first render. Both facts are asserted here.
 */

const read = (...segments: string[]) =>
    fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');

describe('NativeWind interop for Reanimated components', () => {
    it('registers className interop for the Animated components the app styles', () => {
        const bridge = read('components', 'theme', 'nativewindAnimated.ts');

        expect(bridge).toContain("import { cssInterop } from 'nativewind'");
        ['Animated.View', 'Animated.Text', 'Animated.ScrollView', 'Animated.FlatList'].forEach(
            (component) => {
                expect(bridge).toContain(`cssInterop(${component},`);
            }
        );
        expect(bridge).toContain('contentContainerClassName');
    });

    it('loads the bridge from the app root', () => {
        expect(read('app', '_layout.tsx')).toContain(
            "import '@/components/theme/nativewindAnimated'"
        );
    });

    it('keeps skeletons on interop-covered components', () => {
        // The skeleton block is the canary: its sizing comes entirely from
        // className, so a dropped className means invisible loading states.
        const skeleton = read('components', 'ui', 'Skeleton.tsx');
        expect(skeleton).toContain('<Animated.View');
        expect(skeleton).toContain('className={baseClassName}');
        expect(skeleton).toContain("overflow-hidden bg-divider-light/80 dark:bg-divider-dark/80");
    });
});
