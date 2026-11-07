/* eslint-disable import/first */
/**
 * Screen-wiring guard: the journal route must hand unsent composer words to
 * the finish hook; otherwise hook-level tests cannot catch a dropped prop.
 */
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(process.cwd(), 'app', 'chat.tsx'), 'utf8');

describe('journal chat pending words wiring', () => {
    it('passes inputValue into the finish hook', () => {
        const hookCall = source.slice(
            source.indexOf('useJournalChatFinish({'),
            source.indexOf('});', source.indexOf('useJournalChatFinish({')),
        );
        expect(hookCall).toContain('inputValue');
    });

    it('lets Finish entry work for words still in the writing slip', () => {
        expect(source).toContain(
            "const canFinish = (hasContent(messages) || inputValue.trim().length > 0) && !isLoading && !isSaving;",
        );
    });

    it('makes the speaker available only when there is a reply to read', () => {
        expect(source).toContain(
            'available: Boolean(latestCompanionText) || isSpeaking,',
        );
    });
});
