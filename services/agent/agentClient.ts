import { getAgentConfig } from './agentConfig';

export async function postAgent(path: string, body: unknown): Promise<Response> {
    const { apiBaseUrl, apiKey } = getAgentConfig();
    const baseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
    }

    try {
        return await fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
    } catch (error) {
        const url = `${baseUrl}${path}`;
        throw new Error(
            `Failed to fetch: Could not connect to AI backend at ${url}. Is the server running?`
        );
    }
}
