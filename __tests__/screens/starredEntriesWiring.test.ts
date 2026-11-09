import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/**
 * Wiring guard for the starred-entries feature. A star button that is not
 * wired to the hook, or a filter that is computed but never used to build the
 * feed, is invisible in a renderer test because the screens need many mocks.
 * Scanning the real source keeps those two links from silently disappearing.
 */
const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

describe('starred entries UI wiring', () => {
    const detail = read(relPosix(root, path.join(root, 'app/entry-detail.tsx')));
    const archive = read(relPosix(root, path.join(root, 'app/(tabs)/entries.tsx')));
    const chain = read(relPosix(root, path.join(root, 'hooks/journal/useArchiveFilters.ts')));
    const section = read(relPosix(root, path.join(root, 'components/history/HistorySection.tsx')));
    const card = read(relPosix(root, path.join(root, 'components/history/HistoryEntryCard.tsx')));
    const util = read(relPosix(root, path.join(root, 'utils/starredSections.ts')));
    const emptyStates = read(relPosix(root, path.join(root, 'components/entries/ArchiveEmptyState.tsx')));

    it('entry detail has one star button bound to toggleStar', () => {
        expect(detail).toContain('useStarredEntries');
        expect(detail).toContain('toggleStar(entryId)');
        expect(detail).toContain('entry-star-button');
        expect(detail).toContain("name={starred ? 'star' : 'star-border'}");
    });

    it('the star button has plain-language accessibility labels', () => {
        expect(detail).toContain("'Remove from starred'");
        expect(detail).toContain("'Add to starred'");
    });

    it('Archive computes the starred filter and feeds it into the feed rows', () => {
        expect(chain).toContain('filterStarredSections(filteredSections, starredSet)');
        expect(archive).toContain('buildFeedRows(visibleSections)');
        expect(archive).toContain('archive-starred-filter');
    });

    it('filter matches the raw entry id, never the prefixed display id', () => {
        // Round 34 live QA: "1 shown" with an empty list. HistoryItem.id is
        // `journal-<entryId>`; the star store keeps `sourceId`.
        expect(util).toContain('starredIds.has(item.sourceId)');
        expect(util).not.toContain('starredIds.has(item.id)');
        expect(util).toContain('sourceId');
    });

    it('Archive shows a plain-language empty state for no starred moments', () => {
        expect(archive).toContain('nothingStarred={nothingStarred}');
        expect(emptyStates).toContain('No starred moments yet');
        expect(emptyStates).toContain('Open an entry and tap the star');
    });

    it('the star mark flows from section to card', () => {
        // sourceId is the raw entry id; HistoryItem.id is prefixed for display.
        // Comparing to id shows "1 shown" with an empty list (round 34 live QA).
        expect(section).toContain('starredIds?.has(item.sourceId)');
        expect(section).toContain('isStarred={');
        expect(card).toContain('isStarred = false');
        expect(card).toContain('MaterialIcons');
        expect(card).toContain('name="star"');
    });

    it('resolves every source path on any OS', () => {
        expect(relPosix(root, path.join(root, 'app/entry-detail.tsx'))).toBe('app/entry-detail.tsx');
        expect(relPosix(root, path.join(root, 'app/(tabs)/entries.tsx'))).toBe('app/(tabs)/entries.tsx');
    });
});
