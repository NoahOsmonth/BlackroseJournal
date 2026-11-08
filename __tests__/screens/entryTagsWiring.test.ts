import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, relPosix(root, path.join(root, file))), 'utf8');

describe('writer-chosen label wiring (Kaneo #88)', () => {
    const archive = read('app/(tabs)/entries.tsx');
    const detail = read('app/entry-detail.tsx');
    const editor = read('components/entries/EntryTagEditor.tsx');
    const row = read('components/entries/TagChipRow.tsx');
    const service = read('services/journal/entryTags.ts');
    const hook = read('hooks/journal/useEntryTags.ts');
    const util = read('utils/entryTags.ts');
    const backup = read('services/backup/localBackup.ts');
    const clear = read('hooks/journal/useClearJournalHistory.ts');
    const ownership = read('services/account/legacyDataOwnership.ts');
    const agents = read('AGENTS.md');

    it('one owner owns the key with a schema envelope and a serialized queue', () => {
        expect(service).toContain("export const ENTRY_TAGS_KEY = '@blackrose_entry_tags'");
        expect(service).toContain('schemaVersion: SCHEMA_VERSION');
        expect(service).toContain('mutationQueue.then(operation, operation)');
        expect(service).toContain('registerAccountTeardown(');
        expect(service).toContain('try {\n        const parsed = JSON.parse(raw)');
        expect(agents).toContain('| `@blackrose_entry_tags` | `services/journal/entryTags.ts` |');
    });

    it('UI goes through the hook, never straight to storage', () => {
        expect(detail).toContain("from '@/components/entries/EntryTagEditor'");
        expect(detail).toContain('useEntryTags()');
        expect(editor).toContain('tags.addTag(entryId, draft)');
        expect(editor).toContain('tags.removeTag(entryId, label)');
        expect(editor).not.toContain('AsyncStorage');
        expect(editor).not.toContain('@blackrose_');
        expect(hook).toContain('subscribeEntryTagChanges(');
        expect(archive).toContain('useEntryTags()');
        expect(archive).not.toContain('@blackrose_');
    });

    it('the Archive filter chain puts labels LAST before days', () => {
        expect(archive).toContain('filterSectionsByTag(afterTopicSections, resolvedTag, tagsByEntry)');
        expect(archive).toContain('buildWrittenDayChips(afterTagSections)');
        expect(archive).toContain('resolveActiveTag(tagChips, activeTag)');
        expect(archive).toContain('<TagChipRow');
        expect(archive).toContain('noTagMatches={noTagMatches}');
        expect(row).toContain('testID="archive-tag-row"');
        expect(row).toContain('Show every label');
        expect(row).toContain('min-h-11');
        expect(row).toContain('dark:text-text-dark');
    });

    it('chips count honestly against the narrowed feed, no extra storage read', () => {
        expect(archive).toContain('collectTagChips(afterTopicSections, tagsByEntry)');
        expect(archive).toContain('countTagItems(afterTopicSections, label, tagsByEntry)');
        expect(archive).toContain('countFor={countTagFor}');
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useState');
        expect(util).not.toContain('Date.now()');
    });

    it('backup, restore, ownership and Clear History are all coupled', () => {
        expect(backup).toContain("case '@blackrose_entry_tags':");
        expect(backup).toContain('importEntryTagsSnapshot(value)');
        expect(backup).toContain("|| key === '@blackrose_entry_tags'");
        expect((backup.match(/'@blackrose_entry_tags'/g) ?? []).length).toBeGreaterThanOrEqual(4);
        expect(ownership).toContain("'@blackrose_entry_tags'");
        expect(clear).toContain('clearAllEntryTags');
        expect(clear).toContain("['your labels', clearAllEntryTags]");
    });

    it('user-facing copy stays plain and both schemes are covered', () => {
        expect(editor).toContain('Your labels');
        expect(editor).toContain('A word for this entry');
        expect(editor).toContain('Add this label');
        expect(editor).not.toContain('provider');
        expect(editor).not.toContain('schema');
        expect(editor).toContain('dark:');
        expect(row).not.toMatch(/space-y-|space-x-/);
        expect(editor).not.toMatch(/space-y-|space-x-/);
    });

    it('UI files stay inside the design budget', () => {
        expect(archive.split('\n').length).toBeLessThanOrEqual(450);
        expect(editor.split('\n').length).toBeLessThanOrEqual(500);
        expect(row.split('\n').length).toBeLessThanOrEqual(500);
    });
});
