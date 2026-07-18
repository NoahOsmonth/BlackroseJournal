import {
    fetchDirectChatCompletion,
} from '@/services/ai/directTransport';
import type { MemoryGraphAtom } from './memoryGraph.types';

interface ChatCompletionResponse {
    choices?: {
        message?: {
            content?: string;
        };
    }[];
}

export type MemoryInsightMode = 'glance' | 'deep';

export interface SynthesizeMemoryInsightOptions {
    relatedTitles?: readonly string[];
    mode?: MemoryInsightMode;
}

const GLANCE_SYSTEM = `You write the "At a glance" blurb on a private journal memory graph.
Speak to the journaler in warm, specific prose (2–3 short sentences, max 50 words).
Ground the insight in the memory title/content. You may lightly weave nearby memories if listed.
NEVER use meta/system language: no "system synthesis", "pinned note", "drawn from", "journal entry",
"nodes", "related nodes", "shares a source", "tags:", "memoryies", layer names, or graph jargon.
Do not list tags. Do not start with "This is". Just the insight.`;

const DEEP_SYSTEM = `You deepen a private journal memory for the person who wrote it.
Write 3–5 sentences (max 80 words) that connect feelings, patterns, and a gentle next question or observation.
Warm, specific, no therapy clichés. No meta language about systems, nodes, tags, or data sources.`;

function buildUserPayload(
    atom: MemoryGraphAtom,
    options?: SynthesizeMemoryInsightOptions
): string {
    const related = (options?.relatedTitles ?? [])
        .map((title) => title.trim())
        .filter(Boolean)
        .slice(0, 4);
    return [
        `Title: ${atom.title}`,
        `Memory: ${atom.content}`,
        related.length > 0 ? `Nearby memories: ${related.join(' · ')}` : '',
    ]
        .filter(Boolean)
        .join('\n');
}

export async function synthesizeMemoryInsight(
    atom: MemoryGraphAtom,
    options?: SynthesizeMemoryInsightOptions
): Promise<string> {
    const mode = options?.mode ?? 'glance';
    const maxTokens = mode === 'deep' ? 320 : 220;

    const response = await fetchDirectChatCompletion(
        {
            model: 'agent-default',
            messages: [
                {
                    role: 'system',
                    content: mode === 'deep' ? DEEP_SYSTEM : GLANCE_SYSTEM,
                },
                {
                    role: 'user',
                    content: buildUserPayload(atom, options),
                },
            ],
            temperature: 0.7,
            max_tokens: maxTokens,
            stream: false,
        },
        { modelPurpose: 'flash' }
    );

    if (!response.ok) {
        throw new Error(`Memory insight request failed: ${response.statusText}`);
    }

    const data = await response.json() as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content?.trim()) {
        throw new Error('Memory insight response did not include content.');
    }

    return content.trim().replace(/^["']|["']$/g, '');
}
