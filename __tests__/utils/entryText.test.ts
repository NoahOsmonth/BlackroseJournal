import { buildEntryText, rebuildMessagesForEditedText } from '../../utils/entryText';
import type { Message } from '../../services/ai/chatTypes';

function msg(partial: Partial<Message> & Pick<Message, 'role' | 'content'>): Message {
    return { id: `m-${partial.role}-${partial.content.slice(0, 4)}`, timestamp: 1, ...partial } as Message;
}

describe('buildEntryText', () => {
    it('joins user turns in order and ignores assistant replies', () => {
        const text = buildEntryText([
            msg({ role: 'user', content: 'First thought.' }),
            msg({ role: 'assistant', content: 'Tell me more.' }),
            msg({ role: 'user', content: 'Second thought.' }),
        ]);
        expect(text).toBe('First thought.\n\nSecond thought.');
    });

    it('skips blank user turns', () => {
        expect(buildEntryText([
            msg({ role: 'user', content: '   ' }),
            msg({ role: 'user', content: 'Only line.' }),
        ])).toBe('Only line.');
    });

    it('returns an empty string for an entry with no user text', () => {
        expect(buildEntryText([msg({ role: 'assistant', content: 'Hi' })])).toBe('');
    });
});

describe('rebuildMessagesForEditedText', () => {
    it('collapses user turns into the edited body and keeps assistant replies', () => {
        const rebuilt = rebuildMessagesForEditedText([
            msg({ id: 'anchor', role: 'user', content: 'First thought.' }),
            msg({ id: 'a1', role: 'assistant', content: 'Tell me more.' }),
            msg({ id: 'second', role: 'user', content: 'Second thought.' }),
        ], '  Rewritten body.  ');

        expect(rebuilt.map((m) => `${m.role}:${m.content}`)).toEqual([
            'user:Rewritten body.',
            'assistant:Tell me more.',
        ]);
        expect(rebuilt[0].id).toBe('anchor');
    });

    it('mints an authored turn when the entry had none', () => {
        const rebuilt = rebuildMessagesForEditedText(
            [msg({ role: 'assistant', content: 'Hi' })],
            'New body.',
        );
        expect(rebuilt).toHaveLength(2);
        expect(rebuilt[0]).toMatchObject({ role: 'user', content: 'New body.' });
    });

    it('round-trips with buildEntryText', () => {
        const rebuilt = rebuildMessagesForEditedText(
            [msg({ role: 'user', content: 'old' }), msg({ role: 'assistant', content: 'reply' })],
            'Brand new text.',
        );
        expect(buildEntryText(rebuilt)).toBe('Brand new text.');
    });
});
