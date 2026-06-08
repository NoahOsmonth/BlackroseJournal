import {
    fetchDirectChatCompletion,
} from '@/services/ai/directTransport';
import type { LocalMemoryAtom } from './memoryGraph.types';

interface ChatCompletionResponse {
    choices?: {
        message?: {
            content?: string;
        };
    }[];
}

export async function synthesizeMemoryInsight(atom: LocalMemoryAtom): Promise<string> {
    const response = await fetchDirectChatCompletion({
        model: 'agent-default',
        messages: [
            {
                role: 'system',
                content: 'Generate a concise synthesis insight from this memory atom.',
            },
            {
                role: 'user',
                content: [
                    `Title: ${atom.title}`,
                    `Content: ${atom.content}`,
                    `Layer: ${atom.layer}`,
                    `Tags: ${atom.tags.join(', ')}`,
                ].join('\n'),
            },
        ],
    });

    if (!response.ok) {
        throw new Error(`Memory insight request failed: ${response.statusText}`);
    }

    const data = await response.json() as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
        throw new Error('Memory insight response did not include content.');
    }

    return content.trim();
}
