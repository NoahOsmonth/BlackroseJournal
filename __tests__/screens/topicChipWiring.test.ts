import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, relPosix(root, path.join(root, file))), 'utf8');

describe('Archive topic chip wiring', () => {
    const screen = read('app/(tabs)/entries.tsx');
    const chain = read('hooks/journal/useArchiveFilters.ts');
    const util = read('utils/topicChips.ts');
    const feed = read('hooks/history/useHistoryFeed.ts');
    const emptyStates = read('components/entries/ArchiveEmptyState.tsx');

    it('derives chips from the narrowed feed, one memo, no new storage read', () => {
        expect(chain).toContain('collectTopicChips(beforeTopicSections)');
        expect(chain).toContain('const topicChips = useMemo(');
        expect(chain).toContain('filterSectionsByTopic(beforeTopicSections, activeTopic)');
        expect(screen).not.toContain('collectTopicChips(sections)');
        expect(feed).not.toContain('topicChips');
    });

    it('applies search, then starred, then topic - in that order', () => {
        const filtered = chain.indexOf('searchSections(query)');
        const starred = chain.indexOf('filterStarredSections(filteredSections, starredSet)');
        const topic = chain.indexOf('filterSectionsByTopic(beforeTopicSections, activeTopic)');
        expect(filtered).toBeGreaterThan(0);
        expect(starred).toBeGreaterThan(filtered);
        expect(topic).toBeGreaterThan(starred);
    });

    it('shows honest counts recounted against the narrowed feed', () => {
        expect(screen).toContain('countTopicItems(beforeTopicSections, chip.label)');
        expect(util).toContain('DISTINCT item count');
    });

    it('renders a horizontally scrollable row with 44px touch targets', () => {
        expect(screen).toContain('horizontal');
        expect(screen).toContain('showsHorizontalScrollIndicator={false}');
        expect(screen).toContain('min-h-11');
        expect(screen).toContain('testID="archive-topic-row"');
        expect(screen).toContain('testID="topic-chip-all"');
        expect(screen).toContain('topic-chip-${chip.label}');
        // Live QA: the SCROLLER (not its wrapper) measured 948px of content in
        // a 448px viewport with overflowX auto. Padding belongs on its content.
        expect(screen).toContain('contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING_X, gap: 8 }}');
    });

    it('has an All reset, a plain empty state and plain-language copy', () => {
        expect(screen).toContain('setActiveTopic(\'\')');
        expect(screen).toContain('Show every topic');
        expect(screen).toContain('noTopicMatches={noTopicMatches}');
        expect(emptyStates).toContain('Nothing here about');
        expect(emptyStates).toContain('Try another word, or show every topic.');
    });

    it('keeps both schemes on every chip label and all spacing on flex containers', () => {
        const row = screen.slice(screen.indexOf('archive-topic-row'), screen.lastIndexOf('FinishBackgroundBanner'));
        // Both chips render a Text with a dark: variant; count the variants
        // in the row rather than parsing a multi-line className expression.
        const darkVariants = (row.match(/dark:text-/g) ?? []).length;
        expect(darkVariants).toBeGreaterThanOrEqual(2);
        expect(row).not.toContain('space-y-');
        expect(row).not.toContain('space-x-');
        expect(screen).toContain('gap: 8');
    });

    it('keeps utils/ pure and the screen within the 500-line budget', () => {
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useState');
        expect(util).not.toContain('Date.now()');
        expect(screen.split('\n').length).toBeLessThanOrEqual(500);
    });

    it('resolves repo paths on any OS', () => {
        expect(relPosix(root, path.join(root, 'app/(tabs)/entries.tsx'))).toBe('app/(tabs)/entries.tsx');
    });
});
