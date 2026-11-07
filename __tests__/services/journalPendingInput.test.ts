import { withPendingInput } from '../../services/journal/journalPendingInput';

describe('withPendingInput', () => {
    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(123);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('leaves sent messages alone when the composer is blank', () => {
        const messages = [{ id: 'm1', role: 'user' as const, content: 'Sent words', timestamp: 1 }];
        expect(withPendingInput(messages, '   ')).toEqual(messages);
    });

    it('appends typed words as a dated user message', () => {
        const messages = [{ id: 'm1', role: 'user' as const, content: 'Sent words', timestamp: 1 }];
        const result = withPendingInput(messages, '  Unsent words  ');
        expect(result).toEqual([
            messages[0],
            expect.objectContaining({
                id: 'pending-123',
                role: 'user',
                content: 'Unsent words',
                timestamp: 123,
                authoredTimezone: expect.any(String),
                localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                temporalProvenance: 'captured',
            }),
        ]);
    });
});
