/**
 * Device-direct embeddings transport (OpenAI-compatible POST /embeddings).
 *
 * IMPORTANT — freeOnly / chat model guards:
 * - Do NOT route through assertModelAllowed, freeOnly model pickers, or
 *   fetchDirectChatCompletion. Those are chat-only.
 * - Same API key + base URL as chat (getResolvedDirectConfig).
 * - Model id comes from services/memory/embeddings.ts constants only.
 *
 * Soft-fail friendly: callers treat null as "offline / skip semantic match".
 */

import { getResolvedDirectConfig } from './directConfig';
import { getProviderCapabilities } from './providerCapabilities';
import {
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    l2Normalize,
} from '@/services/memory/embeddings';

export interface EmbedTextsOptions {
    /** Override model (tests). Defaults to EMBEDDING_MODEL. */
    model?: string;
    signal?: AbortSignal;
}

function buildEmbeddingsUrl(apiBaseUrl: string): string {
    const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
    return `${base}/embeddings`;
}

function extractVectors(json: unknown, expectedCount: number): number[][] | null {
    if (!json || typeof json !== 'object') return null;
    const data = (json as { data?: unknown }).data;
    if (!Array.isArray(data) || data.length === 0) return null;

    const sorted = [...data].sort((a, b) => {
        const ai = typeof a === 'object' && a && 'index' in a
            ? Number((a as { index?: number }).index) || 0
            : 0;
        const bi = typeof b === 'object' && b && 'index' in b
            ? Number((b as { index?: number }).index) || 0
            : 0;
        return ai - bi;
    });

    const out: number[][] = [];
    for (const row of sorted) {
        if (!row || typeof row !== 'object') return null;
        const emb = (row as { embedding?: unknown }).embedding;
        if (!Array.isArray(emb) || emb.length === 0) return null;
        const nums: number[] = [];
        for (const n of emb) {
            if (typeof n !== 'number' || !Number.isFinite(n)) return null;
            nums.push(n);
        }
        out.push(l2Normalize(nums));
    }
    if (out.length !== expectedCount) return null;
    return out;
}

/**
 * Embed one or more strings. Returns L2-normalized vectors, or null on failure.
 * Never throws for network/provider errors (returns null + console.warn).
 */
export async function embedTexts(
    texts: readonly string[],
    options: EmbedTextsOptions = {},
): Promise<number[][] | null> {
    const cleaned = texts.map((t) => t.trim()).filter(Boolean);
    if (cleaned.length === 0) return null;

    try {
        const config = await getResolvedDirectConfig();
        const capabilities = getProviderCapabilities(config.apiBaseUrl);
        const model = options.model ?? EMBEDDING_MODEL;
        const url = buildEmbeddingsUrl(config.apiBaseUrl);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${config.apiKey}`,
                ...capabilities.extraHeaders,
            },
            body: JSON.stringify({
                model,
                input: cleaned.length === 1 ? cleaned[0] : cleaned,
            }),
            ...(options.signal ? { signal: options.signal } : {}),
        });

        if (!response.ok) {
            const preview = await response.text().catch(() => '');
            console.warn(
                `Embeddings failed (${response.status}) model=${model}: ${preview.slice(0, 160)}`,
            );
            return null;
        }

        const json: unknown = await response.json();
        const vectors = extractVectors(json, cleaned.length);
        if (!vectors) {
            console.warn('Embeddings response missing usable vectors');
            return null;
        }

        // Dimension note only — do not hard-fail if provider returns a close variant.
        if (vectors[0] && vectors[0].length !== EMBEDDING_DIMENSIONS) {
            console.warn(
                `Embeddings dim ${vectors[0].length} != locked ${EMBEDDING_DIMENSIONS} `
                + `(model=${model}); storing as returned after L2 normalize.`,
            );
        }

        return vectors;
    } catch (error) {
        console.warn('Embeddings request error:', error);
        return null;
    }
}

/** Embed a single string; null on failure. */
export async function embedText(
    text: string,
    options: EmbedTextsOptions = {},
): Promise<number[] | null> {
    const batch = await embedTexts([text], options);
    return batch?.[0] ?? null;
}
