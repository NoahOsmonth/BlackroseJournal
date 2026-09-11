import fs from 'fs';
import path from 'path';
import { tabConfig } from '../../components/journal/BottomNav';

describe('BottomNav tabConfig', () => {
    it('labels the graph tab Threads and the list tab Archive, keeping route ids stable', () => {
        expect(tabConfig.map((t) => ({ name: t.name, iconId: t.iconId, label: t.label }))).toEqual(
            expect.arrayContaining([
                { name: 'explore', iconId: 'graph', label: 'Threads' },
                { name: 'today', iconId: 'sun', label: 'Today' },
                { name: 'entries', iconId: 'book-open', label: 'Archive' },
                { name: 'insights', iconId: 'lightbulb', label: 'Insights' },
                { name: 'settings', iconId: 'gear', label: 'Settings' },
            ])
        );
    });

    it('never ships a pre-rewrite nav label', () => {
        const labels = tabConfig.map((t) => t.label);
        expect(labels).not.toContain('Memory');
        expect(labels).not.toContain('History');
        expect(labels).not.toContain('Explore');
    });

    it('keeps settings in the config even though the dock only shows four tabs + write', () => {
        expect(tabConfig.some((t) => t.name === 'settings')).toBe(true);
        expect(tabConfig.filter((t) => t.name !== 'settings')).toHaveLength(4);
    });
});

describe('BottomNav Blackrose dock styling', () => {
    const src = fs.readFileSync(
        path.join(process.cwd(), 'components/journal/BottomNav.tsx'),
        'utf-8'
    );

    it('uses a hairline bar surface in both schemes (not always black)', () => {
        expect(src).toContain('bg-surface-light');
        expect(src).toContain('dark:bg-background-dark');
        expect(src).toContain('border-hairline-light dark:border-hairline-dark');
        // Bare light-mode black bar is banned.
        expect(src).not.toMatch(/(?<!dark:)bg-black\/\d+/);
    });

    it('is a flat edge bar with a hairline top rule, not an island capsule', () => {
        // The island capsule (rounded 34 + raised shadow) is the old geometry.
        expect(src).not.toContain('borderRadius: 34');
        expect(src).not.toContain('boxShadow');
        expect(src).toContain('border-t border-hairline-light');
        expect(src).not.toContain('home indicator');
    });

    it('distributes four equal flex slots (tabs never pile on the left)', () => {
        // Outer View owns flex:1 — AnimatedPressable must not be the flex child.
        expect(src).toMatch(/flex:\s*1,\s*alignItems:\s*'center'/);
        expect(src).toContain("flexDirection: 'row'");
        // Guard against the regression: className flex-1 on AnimatedPressable alone.
        expect(src).not.toMatch(/className="[^"]*flex-1[^"]*"/);
    });

    it('gives tab labels explicit light and dark text colors', () => {
        expect(src).toContain('text-text-light dark:text-text-dark');
        expect(src).toContain(
            'text-text-secondary-light dark:text-text-secondary-dark'
        );
    });

    it('uses a compact quill control, not a giant filled center FAB', () => {
        expect(src).toContain('useThemeSettings');
        expect(src).toContain('accentDark');
        expect(src).toContain('accentLight');
        expect(src).toContain('MaterialIcons');
        expect(src).toContain('Write new entry');
        // The old 56px filled circle with a ring and lift is gone.
        expect(src).not.toContain('marginTop: -10');
        expect(src).not.toContain('borderRadius: 28');
        expect(src).toContain('w-11 h-11 rounded-control');
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
