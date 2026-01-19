/**
 * Supermemory API Proxy
 * Proxies requests to Supermemory API to avoid CORS issues on web
 */

const SUPERMEMORY_BASE_URL = process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai';
const SUPERMEMORY_API_KEY = process.env.SUPERMEMORY_API_KEY;

export async function POST(request: Request): Promise<Response> {
    if (!SUPERMEMORY_API_KEY) {
        return Response.json(
            { error: 'Supermemory API key not configured' },
            { status: 500 }
        );
    }

    try {
        const body = await request.json();
        const { path, ...requestBody } = body;

        if (!path || typeof path !== 'string') {
            return Response.json(
                { error: 'Missing or invalid path parameter' },
                { status: 400 }
            );
        }

        const targetUrl = `${SUPERMEMORY_BASE_URL}${path}`;
        console.log('[Supermemory Proxy] Forwarding to:', targetUrl);

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPERMEMORY_API_KEY}`,
            },
            body: JSON.stringify(requestBody),
        });

        const responseText = await response.text();
        console.log('[Supermemory Proxy] Response status:', response.status);

        if (!response.ok) {
            return new Response(responseText, {
                status: response.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Try to parse as JSON, otherwise return as text
        try {
            const data = JSON.parse(responseText);
            return Response.json(data);
        } catch {
            return new Response(responseText, {
                status: response.status,
                headers: { 'Content-Type': 'text/plain' },
            });
        }
    } catch (error) {
        console.error('[Supermemory Proxy] Error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return Response.json(
            { error: `Proxy error: ${message}` },
            { status: 500 }
        );
    }
}
