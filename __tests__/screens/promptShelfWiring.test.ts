import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

/** Source-scan guard: the shelf has too many mocks to render in Jest. */
const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');

describe('prompt shelf wiring', () => {
    const screen = read(relPosix(root, path.join(root, 'app/prompt-shelf.tsx')));
    const layout = read(relPosix(root, path.join(root, 'app/_layout.tsx')));
    const today = read(relPosix(root, path.join(root, 'app/(tabs)/today.tsx')));
    const insights = read(relPosix(root, path.join(root, 'app/(tabs)/insights.tsx')));
    const hook = read(relPosix(root, path.join(root, 'hooks/prompts/useSavedStarters.ts')));
    const service = read(relPosix(root, path.join(root, 'services/prompts/savedPromptPacks.ts')));
    const util = read(relPosix(root, path.join(root, 'utils/promptPacks.ts')));
    const backup = read(relPosix(root, path.join(root, 'services/backup/localBackup.ts')));
    const ownership = read(relPosix(root, path.join(root, 'services/account/legacyDataOwnership.ts')));
    const clear = read(relPosix(root, path.join(root, 'hooks/journal/useClearJournalHistory.ts')));
    const chat = read(relPosix(root, path.join(root, 'app/chat.tsx')));
    const finish = read(relPosix(root, path.join(root, 'hooks/chat/useJournalChatFinish.ts')));
    const todayShelf = read(relPosix(root, path.join(root, 'components/today/GuidedPromptShelf.tsx')));

    it('registers the route in the root stack', () => {
        expect(layout).toContain('name="prompt-shelf"');
    });

    it('has two plain doors into the shelf', () => {
        expect(today).toContain("router.push('/prompt-shelf')");
        expect(today).toContain('see-prompt-shelf');
        expect(insights).toContain("router.push('/prompt-shelf')");
        expect(insights).toContain('see-prompt-shelf');
        expect(today + insights).toContain('starting points');
    });

    it('the screen uses the hook, not the service directly', () => {
        expect(screen).toContain('useSavedStarters()');
        expect(screen).not.toContain('listSavedStarters(');
        expect(screen).not.toContain('toggleSavedStarter(');
        expect(hook).toContain('subscribeSavedStarters(');
        // Strip comments before checking identifiers: a prose note is not code.
        const code = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(code).not.toContain('useFocusEffect');
    });

    it('a starter tap opens chat with its seed AND its id', () => {
        expect(screen).toContain("pathname: '/chat'");
        expect(screen).toContain('params: { seed: opening, starterId }');
        expect(screen).toContain('onPress={() => onPick(prompt.opening, prompt.id)}');
        expect(screen).toContain('prompt-starter-');
    });

    it('favorites go through the one owning service', () => {
        expect(screen).toContain('onToggle(prompt.id)');
        expect(screen).toContain('onToggle={toggle}');
        expect(screen).toContain('saved-starter-');
        expect(service).toContain("export const SAVED_STARTERS_KEY = '@blackrose_saved_prompt_starters'");
        expect(service).toContain('schemaVersion');
        expect(service).toContain('enqueueMutation');
        expect(service).toContain('normalizeSavedPromptIds');
        expect(service).toContain('runAccountBoundOperation');
    });

    it('the pure builder has no I/O, hooks or clock', () => {
        expect(util).not.toContain('AsyncStorage');
        expect(util).not.toContain('useState');
        expect(util).not.toContain('Date.now()');
        expect(util).toContain('PROMPT_PACKS');
        expect(util).toContain('normalizeSavedPromptIds');
    });

    it('keeps 44px rows, both schemes, and no dropped spacing', () => {
        expect(screen).toContain('min-h-11');
        expect(screen).not.toContain('space-y-');
        expect(screen).not.toContain('space-x-');
        expect(screen).toContain('dark:text-text-dark');
        expect(screen).toContain('dark:bg-surface-dark');
        expect(screen).toContain('dark:border-hairline-dark');
    });

    it('couples both starter keys to backup, ownership and Clear History', () => {
        expect(backup.match(/saved_prompt_starters/g)).toHaveLength(2);
        expect(backup.match(/written_prompt_starters/g)).toHaveLength(2);
        expect(ownership).toContain('@blackrose_saved_prompt_starters');
        expect(ownership).toContain('@blackrose_written_prompt_starters');
        expect(clear).toContain("['saved starters', clearSavedStarters]");
        expect(clear).toContain("['written starters', clearWrittenStarters]");
        expect(clear).toContain("from '@/services/prompts/savedPromptPacks'");
        expect(clear).toContain("from '@/services/prompts/writtenPromptStarters'");
    });

    it('shows a real progress bar driven by written ids, not taps', () => {
        expect(screen).toContain('useWrittenStarters()');
        expect(screen).toContain('packProgress(pack, writtenIds)');
        expect(screen).toContain('pack-progress-fill-');
        expect(screen).toContain('accessibilityRole="progressbar"');
        expect(screen).toContain('accessibilityLabel={done + \' of \' + total + \' written\'}');
        expect(screen).toContain('accessibilityValue={{ min: 0, max: total, now: done');
        expect(screen).toContain('width: `${pct}%`');
        expect(screen).toContain('bg-accent-green dark:bg-accent-green-dark');
        expect(screen).toContain('starter-written-');
        expect(screen).not.toContain('markStarterWritten(');
    });

    it('counts progress only after the entry was saved', () => {
        expect(finish).toContain('if (starterId) {');
        expect(finish).toContain('void markStarterWritten(starterId).catch(() => undefined)');
        expect(finish).toContain("from '@/services/prompts/writtenPromptStarters'");
        const saveIndex = finish.indexOf("status: 'completed'");
        const markIndex = finish.indexOf('markStarterWritten(starterId)');
        expect(saveIndex).toBeGreaterThan(-1);
        expect(markIndex).toBeGreaterThan(saveIndex);
        expect(chat).toContain('starterId?: string');
        expect(chat).toContain('...(starterId ? { starterId } : {})');
        expect(chat).toContain('isKnownPromptId(starterParam)');
    });

    it('keeps the screen under the 500-line design limit', () => {
        expect(screen.split(/\r?\n/).length).toBeLessThanOrEqual(500);
    });

    it('Today starter door carries the id too', () => {
        expect(today).toContain('params: { seed: prompt.opening, starterId: prompt.id }');
        expect(todayShelf).toContain('onPress={() => onPick(prompt)}');
    });

    it('resolves source paths on any OS', () => {
        expect(relPosix(root, path.join(root, 'app/prompt-shelf.tsx'))).toBe('app/prompt-shelf.tsx');
        expect(relPosix(root, path.join(root, 'app/(tabs)/today.tsx'))).toBe('app/(tabs)/today.tsx');
    });
});
