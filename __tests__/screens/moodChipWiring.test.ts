import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, relPosix(root, path.join(root, file))), 'utf8');

describe('Archive mood chip wiring', () => {
    const screen = read('app/(tabs)/entries.tsx');
    const chain = read('hooks/journal/useArchiveFilters.ts');
    const row = read('components/entries/MoodChipRow.tsx');
    const util = read('utils/moodChips.ts');
    const feed = read('hooks/history/useHistoryFeed.ts');
    const moodStrip = read('utils/moodStrip.ts');
    const emptyStates = read('components/entries/ArchiveEmptyState.tsx');

    it('reuses the existing mood normalizer, never a second emoji stripper', () => {
        expect(util).toContain("from '@/utils/moodStrip'");
        expect(util).toContain('plainMoodWord(value)');
        expect(moodStrip).toContain('export function plainMoodWord');
        expect(util).not.toContain('const EMOJI');
    });

    it('puts mood LAST in the filter chain after search, starred and topic', () => {
        const search = chain.indexOf('searchSections(query)');
        const starred = chain.indexOf('filterStarredSections(filteredSections, starredSet)');
        const topic = chain.indexOf('filterSectionsByTopic(beforeTopicSections, activeTopic)');
        const tag = chain.indexOf('filterSectionsByTag(afterTopicSections, resolvedTag, tagsByEntry)');
        const mood = chain.indexOf('filterSectionsByMood(afterTagSections, activeMood)');
        expect(search).toBeGreaterThan(0);
        expect(starred).toBeGreaterThan(search);
        expect(topic).toBeGreaterThan(starred);
        expect(tag).toBeGreaterThan(topic);
        expect(mood).toBeGreaterThan(tag);
        expect(chain).toContain('collectMoodChips(afterTopicSections)');
        expect(chain).toContain('const moodChips = useMemo(');
        expect(chain).toContain('const visibleSections = useMemo(');
    });

    it('counts honestly against the narrowed feed, no new storage read', () => {
        expect(screen).toContain('countMoodItems(afterTopicSections, label)');
        expect(screen).toContain('countMoodItems(afterTopicSections, activeMood) === 0');
        expect(util).toContain('DISTINCT item count');
        expect(feed).not.toContain('moodChips');
        expect(screen).not.toContain('@blackrose_');
    });

    it('renders a real horizontal scroller with 44px targets and an All reset', () => {
        expect(row).toContain('horizontal');
        expect(row).toContain('showsHorizontalScrollIndicator={false}');
        expect(row).toContain('contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING_X, gap: 8 }}');
        expect(row).toContain('min-h-11');
        expect(row).toContain('testID="archive-mood-row"');
        expect(row).toContain('testID="mood-chip-all"');
        expect(row).toContain('testID={`mood-chip-${chip.label}`}');
        expect(row).toContain('Show every feeling');
        expect(screen).toContain('<MoodChipRow');
    });

    it('uses real color tokens, both schemes and plain copy', () => {
        expect(row).toContain('border-accent-green');
        expect(row).toContain('dark:border-accent-green-dark');
        expect(row).toContain('text-text-light dark:text-text-dark');
        expect(row).not.toContain('space-y-');
        expect(row).not.toContain('space-x-');
        expect(screen).toContain('noMoodMatches={noMoodMatches}');
        expect(emptyStates).toContain('Nothing here about feeling');
        expect(emptyStates).toContain('Try another feeling, or show every entry.');
        expect(emptyStates).toContain('testID="archive-mood-empty"');
    });

    it('keeps utils/ pure and both UI files inside the 500-line budget', () => {
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useState');
        expect(util).not.toContain('Date.now()');
        expect(screen.split('\n').length).toBeLessThanOrEqual(500);
        expect(row.split('\n').length).toBeLessThanOrEqual(500);
    });

    it('does not break the round 39 topic chips', () => {
        expect(chain).toContain('collectTopicChips(beforeTopicSections)');
        expect(screen).toContain('testID="archive-topic-row"');
        expect(emptyStates).toContain('Nothing here about');
    });

    it('resolves repo paths on any OS', () => {
        expect(relPosix(root, path.join(root, 'components/entries/MoodChipRow.tsx'))).toBe('components/entries/MoodChipRow.tsx');
    });
});
