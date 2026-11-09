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
    const sheet = read('components/entries/TagRenameSheet.tsx');
    const service = read('services/journal/entryTags.ts');
    const hook = read('hooks/journal/useEntryTags.ts');
    const util = read('utils/entryTags.ts');
    const backup = read('services/backup/localBackup.ts');
    const clear = read('hooks/journal/useClearJournalHistory.ts');
    const ownership = read('services/account/legacyDataOwnership.ts');
    const agents = read('AGENTS.md');
    // The narrowing chain moved into this hook (round 52); the order it
    // enforces is the invariant, so the assertions follow the code.
    const filters = read('hooks/journal/useArchiveFilters.ts');

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
        expect(filters).toContain('filterSectionsByTag(afterTopicSections, resolvedTag, tagsByEntry)');
        expect(filters).toContain('buildWrittenDayChips(afterTagSections)');
        expect(filters).toContain('resolveActiveTag(tagChips, activeTag)');
        expect(archive).toContain('<TagChipRow');
        expect(archive).toContain('noTagMatches={noTagMatches}');
        expect(row).toContain('testID="archive-tag-row"');
        expect(row).toContain('Show every label');
        expect(row).toContain('min-h-11');
        expect(row).toContain('dark:text-text-dark');
    });

    it('chips count honestly against the narrowed feed, no extra storage read', () => {
        expect(filters).toContain('collectTagChips(afterTopicSections, tagsByEntry)');
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

    it('renames a label from the chip row, through the hook, not storage', () => {
        expect(archive).toContain('renameTag');
        expect(archive).toContain('onRename={(from, to) => { void renameTag(from, to); setActiveTag(to); }}');
        expect(row).toContain('readonly onRename?: (from: string, to: string) => void');
        expect(row).toContain('testID="tag-chip-rename"');
        expect(row).toContain('<TagRenameSheet');
        expect(row).toContain('onRename(activeTag, next)');
        // The chip only exists once a label is chosen.
        expect(row).toContain('const canRename = Boolean(onRename) && !allSelected;');
        expect(hook).toContain('renameEntryTag(from, to)');
        expect(hook).toContain('readonly renameTag: (from: string, to: string) => Promise<void>');
        expect(service).toContain('export function renameEntryTag(from: string, to: string)');
        expect(sheet).not.toContain('AsyncStorage');
        expect(sheet).not.toContain('@blackrose_');
    });

    it('the rename sheet is an accessible Modal with both schemes and 44px targets', () => {
        expect(sheet).toContain('<Modal');
        expect(sheet).toContain('KeyboardAvoidingView');
        expect(sheet).toContain('testID="tag-rename-sheet"');
        expect(sheet).toContain('testID="tag-rename-input"');
        expect(sheet).toContain('testID="tag-rename-save"');
        expect(sheet).toContain('min-h-12');
        expect(sheet).toContain('dark:bg-surface-dark');
        expect(sheet).toContain('dark:text-text-dark');
        expect(sheet).not.toMatch(/space-y-|space-x-/);
        expect(sheet).toContain('export function TagRenameSheet(');
    });

    it('an empty new name is refused in the sheet, not silently applied', () => {
        expect(sheet).toContain('if (next.length === 0) {');
        expect(sheet).toContain('setRefused(true)');
        expect(sheet).toContain('testID="tag-rename-refused"');
        expect(sheet).toContain('Give it a name first.');
        // The service refuses it too, so the UI cannot delete a label by accident.
        expect(service).toContain('target.length === 0');
    });

    it('deletes a label from the chip row, through the hook, not storage', () => {
        expect(archive).toContain('deleteTag');
        expect(archive).toContain("onDelete={(label) => { void deleteTag(label); setActiveTag(''); }}");
        expect(row).toContain('readonly onDelete?: (label: string) => void');
        expect(row).toContain('onDelete={onDelete}');
        expect(sheet).toContain('testID="tag-rename-delete"');
        expect(sheet).toContain('Delete this label');
        expect(hook).toContain('deleteEntryTag(label)');
        expect(hook).toContain('readonly deleteTag: (label: string) => Promise<void>');
        expect(service).toContain('export function deleteEntryTag(label: string)');
        expect(sheet).not.toContain('AsyncStorage');
    });

    it('deleting asks first, because it touches every entry that used the label', () => {
        // Alert.alert is a silent no-op on web, so the confirm must be webConfirm.
        expect(sheet).toContain('webConfirm(');
        expect(sheet).toContain('if (answer === false) return;');
        expect(sheet).toContain('It will be removed from every entry that uses it.');
        expect(sheet).not.toContain('Alert.alert');
        expect(sheet).toContain('min-h-12');
        expect(sheet).toContain('dark:text-danger-dark');
    });

    it('an entry left with no labels loses its key, so no empty label is shown', () => {
        expect(service).toContain('if (kept.length > 0) next[entryId] = kept;');
        expect(service).toContain('if (!changed) return toMap(payload);');
    });
});

describe('picking several entries and labelling them (Kaneo #91)', () => {
    const archive = read('app/(tabs)/entries.tsx');
    const bar = read('components/entries/SelectionBar.tsx');
    const sheet = read('components/entries/BulkLabelSheet.tsx');
    const section = read('components/history/HistorySection.tsx');
    const card = read('components/history/HistoryEntryCard.tsx');
    const hook = read('hooks/journal/useEntryTags.ts');
    const service = read('services/journal/entryTags.ts');

    it('the batch goes through the hook, never straight to the service', () => {
        expect(archive).toContain('addTagMany(picked, label)');
        expect(archive).not.toContain('addEntryTagToMany');
        expect(hook).toContain('await addEntryTagToMany(entryIds, label)');
    });

    it('one write covers every picked entry', () => {
        const many = service.slice(service.indexOf('export function addEntryTagToMany'));
        const body = many.slice(0, many.indexOf('export function removeEntryTag'));
        // One read, one write, and the per-entry work inside that single cycle.
        expect(body.split('readPayload(').length - 1).toBe(2);
        expect(body.split('writePayload(').length - 1).toBe(1);
        expect(body).toContain('enqueueMutation(');
    });

    it('the screen shows the bar and the sheet only while picking', () => {
        expect(archive).toContain('{picking ? (');
        expect(archive).toContain('selectedIds={picking ? pickedSet : undefined}');
        expect(archive).toContain('testID="archive-pick-toggle"');
        expect(bar).toContain('testID="selection-bar"');
        expect(sheet).toContain('testID="bulk-label-sheet"');
    });

    it('only journal entries are pickable, because labels belong to entries', () => {
        expect(section).toContain("item.type === 'journal'");
        expect(archive).toContain("picking && item.type === 'journal'");
    });

    it('a picked row says so out loud, for screen readers', () => {
        expect(card).toContain("'Unpick'")
        expect(card).toContain("'Pick'")
        expect(card).toContain('accessibilityState={selected === undefined ? undefined : { selected }}');
    });

    it('finishing or cancelling clears the picks, so a stale set cannot label later', () => {
        const submits = archive.slice(archive.indexOf('onSubmit={(label) => {'));
        expect(submits.slice(0, 400)).toContain('setPicked([])');
        expect(archive).toContain('setPicking(false);');
    });

    it('the removal offers only labels the whole selection shares', () => {
        expect(archive).toContain('sharedLabels(picked, tagsByEntry)');
        expect(archive).toContain('onRemoveLabel={shared.length > 0');
        expect(bar).toContain("testID=\"selection-remove\"");
        expect(bar).toContain('{onRemoveLabel ? (');
    });

    it('removing a batch goes through the hook, one write, like adding', () => {
        expect(archive).toContain("bulkMode === 'add' ? addTagMany(picked, label) : removeTagMany(picked, label)");
        expect(archive).not.toContain('removeEntryTagFromMany');
        expect(hook).toContain('await removeEntryTagFromMany(entryIds, label)');
        const many = service.slice(service.indexOf('export function removeEntryTagFromMany'));
        const fnBody = many.slice(0, many.indexOf('export function removeEntryTag('));
        expect(fnBody.split('readPayload(').length - 1).toBe(2);
        expect(fnBody.split('writePayload(').length - 1).toBe(1);
    });

    it('one sheet serves both modes, so there is one keyboard contract', () => {
        expect(sheet).toContain("export type BulkLabelMode = 'add' | 'remove'");
        expect(sheet).toContain('mode === \'add\' ?');
        expect(archive).toContain('mode={bulkMode}');
    });
});
