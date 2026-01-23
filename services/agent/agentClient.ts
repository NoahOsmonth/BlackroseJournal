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

    return fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}
