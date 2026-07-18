/**
 * E1 — Tool-schema tax: prompt_tokens WITH vs WITHOUT a small 3-tool schema.
 */

import { writeJsonArtifact, writeArtifact } from './shared/artifacts';
import { chatCompletion, type ChatUsage } from './shared/chatClient';
import { applyProbeEnv } from './shared/loadEnv';
import { ROSTER_VERBATIM } from './shared/roster';
import { PROBE_TOOL_SPECS } from './shared/fixtureTools';

/** ~1k-token fixed prompt (wordy on purpose for stable usage). */
export const E1_FIXED_PROMPT = `
You are a careful research assistant helping analyze a private journal corpus.
Your job in this measurement turn is only to acknowledge the instructions and
produce a short plan — do not invent journal contents.

Context (filler for token budget; ignore factual claims):
${Array.from({ length: 28 }, (_, i) => (
    `Paragraph ${i + 1}: Journaling systems often combine short daily notes with `
    + 'occasional long-form reflection. Retrieval quality depends on whether the '
    + 'index preserves dates, topics, and distinctive tokens. Models that merely '
    + 'see tool schemas still pay a context tax even when no tool is called. '
    + 'Designers need measured prompt_token deltas to budget free-tier contexts.'
)).join('\n')}

Task: Reply with exactly three short bullet points describing how you would
approach locating an old journal entry if tools were available. Do not call tools.
`.trim();

export interface E1ModelResult {
    model: string;
    withoutTools: {
        status: number;
        usage: ChatUsage | null;
        errorTaxonomy: string;
        rawError?: string;
    };
    withTools: {
        status: number;
        usage: ChatUsage | null;
        errorTaxonomy: string;
        rawError?: string;
    };
    deltaPromptTokens: number | null;
}

export async function runE1(): Promise<{ results: E1ModelResult[]; artifactPath: string }> {
    const env = applyProbeEnv();
    const models = [...ROSTER_VERBATIM.probeSelection.e1];
    const results: E1ModelResult[] = [];

    for (const model of models) {
        const baseMessages = [
            { role: 'system', content: 'You are a concise assistant for measurement probes.' },
            { role: 'user', content: E1_FIXED_PROMPT },
        ];

        const without = await chatCompletion({
            model,
            messages: baseMessages,
            max_tokens: 200,
            apiKey: env.apiKey,
            apiBaseUrl: env.apiBaseUrl,
        });

        // Offer tools with tool_choice auto (still instruct "do not call tools").
        // tool_choice:'none' was observed to yield delta=0 on OpenRouter free —
        // some hosts appear not to bill schema when tools cannot be selected.
        const withTools = await chatCompletion({
            model,
            messages: baseMessages,
            tools: PROBE_TOOL_SPECS,
            tool_choice: 'auto',
            max_tokens: 200,
            apiKey: env.apiKey,
            apiBaseUrl: env.apiBaseUrl,
        });

        const p0 = without.usage?.prompt_tokens;
        const p1 = withTools.usage?.prompt_tokens;
        const delta = typeof p0 === 'number' && typeof p1 === 'number' ? p1 - p0 : null;

        results.push({
            model,
            withoutTools: {
                status: without.status,
                usage: without.usage,
                errorTaxonomy: without.errorTaxonomy,
                rawError: without.ok ? undefined : without.rawText.slice(0, 800),
            },
            withTools: {
                status: withTools.status,
                usage: withTools.usage,
                errorTaxonomy: withTools.errorTaxonomy,
                rawError: withTools.ok ? undefined : withTools.rawText.slice(0, 800),
            },
            deltaPromptTokens: delta,
        });
    }

    const usageJsons: unknown[] = [];
    for (const r of results) {
        usageJsons.push({
            model: r.model,
            condition: 'without_tools',
            status: r.withoutTools.status,
            usage: r.withoutTools.usage,
            errorTaxonomy: r.withoutTools.errorTaxonomy,
            rawError: r.withoutTools.rawError,
        });
        usageJsons.push({
            model: r.model,
            condition: 'with_tools_schema',
            status: r.withTools.status,
            usage: r.withTools.usage,
            errorTaxonomy: r.withTools.errorTaxonomy,
            rawError: r.withTools.rawError,
        });
    }

    const artifactPath = writeJsonArtifact('e1-tool-schema-tax.json', {
        experiment: 'E1_TOOL_SCHEMA_TAX',
        fixedPromptChars: E1_FIXED_PROMPT.length,
        toolSpecCount: PROBE_TOOL_SPECS.length,
        results,
        usageJsons,
    });
    writeArtifact(
        'e1-usage-jsons.txt',
        usageJsons.map((u, i) => `--- usage JSON ${i + 1}/6 ---\n${JSON.stringify(u, null, 2)}`).join('\n\n'),
    );

    return { results, artifactPath };
}
