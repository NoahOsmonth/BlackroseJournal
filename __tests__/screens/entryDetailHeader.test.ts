/**
 * Entry-detail header contract.
 *
 * Incident: the entry-detail header is a `flex-row items-center justify-between`
 * row holding [Back] [title] [actions]. The title had `numberOfLines={1}` but no
 * flex constraint, so it took its intrinsic width. Entry titles are written by the
 * model and are frequently long ("Friday, the week's gentle exhale"), so the title
 * consumed the row and pushed the actions button off-screen — leaving Edit and
 * Delete with no reachable entry point in the UI.
 *
 * The sibling screen app/intentions/detail.tsx already had this right
 * (`flex-1 text-center`); entry-detail.tsx was the outlier.
 *
 * This is a source contract, not a layout test: react-native-testing-library
 * renders the tree without layout, so it cannot see "off-screen" — which is exactly
 * why the existing EntryDetailProvenance suite (which presses 'Entry actions')
 * stayed green while the button was unreachable on device.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'app/entry-detail.tsx'), 'utf8');

describe('entry-detail header', () => {
    it('renders the actions button', () => {
        expect(src).toContain('accessibilityLabel="Entry actions"');
    });

    it('constrains the title so it cannot displace its siblings', () => {
        // Pull the title element: the Text that renders {title}.
        const titleEl = src.match(/<Text[\s\S]*?\{title\}[\s\S]*?<\/Text>/)?.[0] ?? '';
        expect(titleEl).not.toBe('');
        expect(titleEl).toContain('flex-1');
        expect(titleEl).toContain('numberOfLines={1}');
    });

    it('keeps Back and actions outside the flexible title', () => {
        const row = src.match(/<View className="flex-row items-center[\s\S]*?<\/View>/)?.[0] ?? '';
        expect(row).toContain('justify-between');
        // Both controls are siblings of the constrained title, not inside it.
        expect(row.indexOf('accessibilityLabel="Back"')).toBeLessThan(row.indexOf('{title}'));
        expect(row.indexOf('accessibilityLabel="Entry actions"')).toBeGreaterThan(row.indexOf('{title}'));
    });
});
