import fs from 'fs';
import path from 'path';
import { relPosix } from '../mocks/repoPath';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Archive browse-by-day wiring', () => {
    const screen = read('app/(tabs)/entries.tsx');
    const chain = read('hooks/journal/useArchiveFilters.ts');
    const row = read('components/entries/WrittenDaysRow.tsx');
    const empty = read('components/entries/DayEmptyState.tsx');
    const util = read('utils/writtenDays.ts');
    const emptyStates = read('components/entries/ArchiveEmptyState.tsx');

    it('the day strip is rendered by the Archive screen', () => {
        expect(screen).toContain('<WrittenDaysRow');
        expect(screen).toContain('chips={writtenDayChips}');
        expect(screen).toContain('activeDay={resolvedDay}');
        expect(screen).toContain('onSelect={setActiveDay}');
        expect(screen).toContain('<ArchiveEmptyState');
        expect(screen).toContain('onClearDay={() => setActiveDay(\'\')}');
        expect(emptyStates).toContain('<DayEmptyState');
        expect(emptyStates).toContain('onClear={props.onClearDay}');
    });

    it('the chips come from the narrowed feed, not the whole journal', () => {
        // A chip must not offer a day whose writing search/starred/topic hid.
        // Writer-chosen labels are now the layer immediately before days.
        expect(chain).toContain('buildWrittenDayChips(afterTagSections)');
        expect(screen).not.toContain('buildWrittenDayChips(sections)');
        expect(chain).toContain('resolveActiveTag(tagChips, activeTag)');
        expect(chain).toContain('resolveActiveDay(writtenDayChips, activeDay)');
    });

    it('the day filter is a real layer in the chain, not just a label', () => {
        expect(chain).toContain('filterSectionsByTag(afterTopicSections, resolvedTag, tagsByEntry)');
        expect(chain).toContain('filterSectionsByMood(afterTagSections, activeMood)');
        expect(chain).toContain('filterSectionsByDay(byMood, resolvedDay)');
        expect(screen).toContain('buildFeedRows(visibleSections)');
    });

    it('every day chip has a real press handler and an All-days way out', () => {
        expect(row).toContain("onPress={() => onSelect('')}");
        expect(row).toContain("onPress={() => onSelect(selected ? '' : chip.dateKey)}");
        expect(row).toContain('onSelect: (dateKey: string) => void');
        expect(row).toContain('written-day-all');
        expect(row).toContain('written-day-${chip.dateKey}');
    });

    it('the empty state clears the chosen day in one tap', () => {
        expect(empty).toContain('onPress={onClear}');
        expect(empty).toContain('archive-day-clear');
        expect(empty).toContain('formatWrittenDay(section)');
        expect(empty).toContain('Show every day');
    });

    it('the pure builder owns the feed rows and the day filter', () => {
        expect(util).toContain('export function buildWrittenDayChips(');
        expect(util).toContain('export function filterSectionsByDay(');
        expect(util).toContain('export function resolveActiveDay(');
        expect(util).toContain('export function buildFeedRows(');
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useState');
        expect(util).not.toContain('Date.now()');
    });

    it('keeps 44px targets, both schemes, and no dropped spacing', () => {
        for (const source of [row, empty]) {
            expect(source).toContain('min-h-11');
            expect(source).not.toMatch(/space-y-|space-x-/);
            expect(source).toContain('dark:');
        }
        expect(row).toContain('gap: 8');
        expect(row).toContain('SCREEN_PADDING_X');
    });

    it('uses plain-language copy, not implementation words', () => {
        // Collect only the text a writer can actually read: JSX text nodes
        // and user-facing attributes. Code identifiers like dateKey are fine.
        const visible = [
            ...(row + empty).matchAll(/>\s*([^<>{}\n]+?)\s*</g),
        ].map((m) => m[1].trim()).join(' ');
        const labels = [
            ...(row + empty).matchAll(/(?:accessibilityLabel|placeholder)=(?:"([^"]+)"|\{`([^`]+)`\})/g),
        ].map((m) => (m[1] || m[2] || '').trim()).join(' ');
        const copy = visible + ' ' + labels;
        expect(copy).toContain('All days');
        expect(copy).toContain('Show every day');
        expect(copy).toContain('Read what you wrote on');
        expect(copy).toContain('Try another day, or clear your search.');
        expect(copy.toLowerCase()).not.toMatch(/\b(filter|datekey|schema|cache|sync|session|json)\b/);
    });

    it('keeps the Archive screen under the 450-line warn line', () => {
        const lines = screen.split(/\r?\n/).length;
        expect(lines).toBeLessThan(450);
    });

    it('resolves source paths on any OS', () => {
        expect(relPosix(root, path.join(root, 'app/(tabs)/entries.tsx'))).toContain('entries.tsx');
        expect(relPosix(root, path.join(root, 'utils/writtenDays.ts'))).toContain('writtenDays.ts');
    });
});
