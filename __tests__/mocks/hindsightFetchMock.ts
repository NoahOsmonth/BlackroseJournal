/**
 * Shared Hindsight fetch mock — a `global.fetch` stub returning configurable
 * JSON responses or rejecting, used by hindsight client tests.
 */
export interface HindsightFetchStubResponse {
    ok?: boolean;
    status?: number;
    json?: () => Promise<unknown>;
    /** When set, fetch rejects with this error instead of returning a response. */
    error?: Error;
}

const OK_RESPONSE: HindsightFetchStubResponse = {
    ok: true,
    status: 200,
    json: async () => ({}),
};

export function createHindsightFetchStub(
    responses: HindsightFetchStubResponse[] = []
): jest.Mock {
    const mock = jest.fn();
    mock.mockImplementation(async () => {
        const response = responses.shift() ?? OK_RESPONSE;
        if (response.error) throw response.error;
        return {
            ok: response.ok ?? true,
            status: response.status ?? 200,
            json: response.json ?? (async () => ({})),
        } as Response;
    });
    return mock;
}
