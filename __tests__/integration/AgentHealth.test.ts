const shouldRun = process.env.RUN_INTEGRATION_TESTS === '1';

const baseUrl =
    process.env.EXPO_PUBLIC_AGENT_BASE_URL ||
    process.env.AGENT_BASE_URL ||
    'http://localhost:8787';

if (!shouldRun) {
    describe('Agent health', () => {
        it.skip('integration tests disabled', () => {});
    });
} else {
    describe('Agent health', () => {
        it('responds with ok', async () => {
            if (typeof fetch !== 'function') {
                throw new Error('Global fetch is not available for integration tests.');
            }

            const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`);
            expect(response.ok).toBe(true);

            const json = (await response.json()) as { status?: string };
            expect(json.status).toBe('ok');
        });
    });
}
