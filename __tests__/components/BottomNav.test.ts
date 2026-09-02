import fs from 'fs';
import path from 'path';
import { tabConfig } from '../../components/journal/BottomNav';

describe('BottomNav tabConfig', () => {
    it('exposes Explore as the Memory graph tab without removing active routes', () => {
        expect(tabConfig.map((t) => ({ name: t.name, iconId: t.iconId, label: t.label }))).toEqual(
            expect.arrayContaining([
                { name: 'explore', iconId: 'graph', label: 'Memory' },
                { name: 'today', iconId: 'sun', label: 'Today' },
                { name: 'entries', iconId: 'book-open', label: 'History' },
                { name: 'insights', iconId: 'lightbulb', label: 'Insights' },
                { name: 'settings', iconId: 'gear', label: 'Settings' },
            ])
        );
    });

    it('keeps settings in the config even though the dock only shows four tabs + write', () => {
        expect(tabConfig.some((t) => t.name === 'settings')).toBe(true);
        expect(tabConfig.filter((t) => t.name !== 'settings')).toHaveLength(4);
    });
});

describe('BottomNav floating dock styling', () => {
    const src = fs.readFileSync(
        path.join(process.cwd(), 'components/journal/BottomNav.tsx'),
        'utf-8'
    );

    it('uses a floating surface capsule in both schemes (not always black)', () => {
        expect(src).toContain('bg-surface-light');
        expect(src).toContain('dark:bg-surface-dark');
        // Bare light-mode black bar is banned; dark:bg-black/90 is fine if present
        expect(src).not.toMatch(/(?<!dark:)bg-black\/\d+/);
    });

    it('is an island dock, not a full-bleed edge bar with home-indicator pill', () => {
        expect(src).toContain('borderRadius: 34');
        expect(src).toContain('borderCurve');
        expect(src).not.toContain('w-32 rounded-full bg-gray-300');
        expect(src).not.toContain('home indicator');
    });

    it('distributes five equal flex slots (tabs never pile on the left)', () => {
        // Outer View owns flex:1 — AnimatedPressable must not be the flex child.
        expect(src).toMatch(/flex:\s*1,\s*alignItems:\s*'center'/);
        expect(src).toContain("flexDirection: 'row'");
        expect(src).toContain("width: '100%'");
        // Guard against the regression: className flex-1 on AnimatedPressable alone.
        expect(src).not.toMatch(/className="[^"]*flex-1[^"]*"/);
    });

    it('gives tab labels explicit light and dark text colors', () => {
        expect(src).toContain('text-text-light dark:text-white');
        expect(src).toContain(
            'text-text-secondary-light dark:text-text-secondary-dark'
        );
    });

    it('uses theme accent for the write CTA (not inverted mono FAB only)', () => {
        expect(src).toContain('useThemeSettings');
        expect(src).toContain('accentDark');
        expect(src).toContain('accentLight');
        expect(src).toContain('MaterialIcons');
        expect(src).toContain('Write new entry');
    });

    it('renders MaterialIcons glyph names (no phosphor barrel in the bundle)', () => {
        expect(src).toContain('MaterialIcons');
        expect(src).not.toContain('phosphor-react-native');
        expect(tabConfig.every((t) => typeof t.icon === 'string')).toBe(true);
    });

    it('delegates radial action animation to a hook-safe component', () => {
        const radialSrc = fs.readFileSync(
            path.join(process.cwd(), 'components/journal/radial-menu.tsx'),
            'utf-8'
        );

        expect(src).toContain("from './radial-menu'");
        expect(radialSrc).toContain('function RadialMenuItem');
        expect(radialSrc).toContain('useAnimatedStyle');
        expect(radialSrc).not.toMatch(/\.map\([^)]*=>\s*use(?:SharedValue|AnimatedStyle)/);
    });
});
