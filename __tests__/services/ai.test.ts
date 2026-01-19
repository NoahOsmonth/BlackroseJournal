import { streamChat } from '../../services/ai';

const mockExtra: Record<string, string | undefined> = {};

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        expoConfig: { extra: mockExtra },
        expoGoConfig: { extra: mockExtra },
        manifest: { extra: mockExtra },
    },
}));

const baseMessages = [
    {
        id: 'message-1',
        role: 'user' as const,
        content: 'Hi',
        timestamp: 1,
    },
];

const encodeChunk = (value: string): Uint8Array => {
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(value);
    }

    return Uint8Array.from(Buffer.from(value));
};

const createReader = (chunks: string[]) => {
    let index = 0;

    return {
        read: jest.fn(async () => {
            if (index >= chunks.length) {
                return { done: true, value: undefined };
            }

            const value = encodeChunk(chunks[index]);
            index += 1;
            return { done: false, value };
        }),
    };
};

describe('streamChat', () => {
    const originalApiKey = process.env.NANO_GPT_API_KEY;
    const originalPublicApiKey = process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;

    beforeEach(() => {
        Object.keys(mockExtra).forEach(key => delete mockExtra[key]);
        process.env.NANO_GPT_API_KEY = 'test-key';
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
        if (originalApiKey === undefined) {
            delete process.env.NANO_GPT_API_KEY;
        } else {
            process.env.NANO_GPT_API_KEY = originalApiKey;
        }
        if (originalPublicApiKey === undefined) {
            delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
        } else {
            process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = originalPublicApiKey;
        }
    });

    it('streams when response body is available', async () => {
        const reader = createReader([
            'data: {"choices":[{"delta":{"content":"Hello","reasoning":"Reason "}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"world","reasoning":"two"}}]}\n\n',
            'data: [DONE]\n\n',
        ]);

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            status: 200,
            body: { getReader: () => reader },
        });

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamChat(baseMessages, onChunk, onComplete, onError);

        expect(onError).not.toHaveBeenCalled();
        expect(onChunk).toHaveBeenCalledTimes(2);
        expect(onComplete).toHaveBeenCalledWith('Helloworld', 'Reason two');
    });

    it('falls back to non-streaming when response body is null', async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: null,
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    JSON.stringify({
                        choices: [
                            {
                                message: {
                                    content: 'Fallback content',
                                    reasoning: 'Fallback reasoning',
                                },
                            },
                        ],
                    }),
            });

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamChat(baseMessages, onChunk, onComplete, onError);

        expect(onError).not.toHaveBeenCalled();
        expect(onChunk).toHaveBeenCalledWith('Fallback content', 'Fallback reasoning');
        expect(onComplete).toHaveBeenCalledWith('Fallback content', 'Fallback reasoning');

        const firstPayload = JSON.parse(
            (global.fetch as jest.Mock).mock.calls[0][1].body as string
        );
        const secondPayload = JSON.parse(
            (global.fetch as jest.Mock).mock.calls[1][1].body as string
        );

        expect(firstPayload.stream).toBe(true);
        expect(secondPayload.stream).toBe(false);
    });

    it('reports HTTP errors with context', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 401,
            text: async () => 'Unauthorized',
            body: null,
        });

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamChat(baseMessages, onChunk, onComplete, onError);

        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('status 401'),
            })
        );
        expect(onComplete).not.toHaveBeenCalled();
    });

    it('uses EXPO_PUBLIC api key when available', async () => {
        delete process.env.NANO_GPT_API_KEY;
        process.env.EXPO_PUBLIC_NANO_GPT_API_KEY = 'public-key';

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                body: null,
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () =>
                    JSON.stringify({
                        choices: [
                            {
                                message: {
                                    content: 'Public content',
                                },
                            },
                        ],
                    }),
            });

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamChat(baseMessages, onChunk, onComplete, onError);

        const headers = (global.fetch as jest.Mock).mock.calls[0][1]
            .headers as Record<string, string>;

        expect(headers.Authorization).toBe('Bearer public-key');
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledWith('Public content', '');
    });

    it('fails fast when the API key is missing', async () => {
        delete process.env.NANO_GPT_API_KEY;
        delete process.env.EXPO_PUBLIC_NANO_GPT_API_KEY;
        Object.keys(mockExtra).forEach(key => delete mockExtra[key]);

        const onChunk = jest.fn();
        const onComplete = jest.fn();
        const onError = jest.fn();

        await streamChat(baseMessages, onChunk, onComplete, onError);

        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('NANO_GPT_API_KEY'),
            })
        );
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
