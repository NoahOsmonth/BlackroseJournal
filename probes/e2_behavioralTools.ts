/**
 * E2 — Behavioral tool harness: model decides, script executes fixture tools.
 * Hard cap 6 rounds. Q1 semantic needle, Q2 list-only needle.
 */

import { writeArtifact, writeJsonArtifact } from './shared/artifacts';
import {
    chatCompletion,
    extractAssistantMessage,
    type ChatMessage,
    type ChatUsage,
} from './shared/chatClient';
import {
    buildProbeFixture,
    SEMANTIC_NEEDLE_TOKEN,
    type ProbeFixture,
} from './shared/fixture';
import { executeProbeTool, PROBE_TOOL_SPECS } from './shared/fixtureTools';
import { applyProbeEnv } from './shared/loadEnv';
import { ROSTER_VERBATIM } from './shared/roster';

const MAX_ROUNDS = 6;

const SYSTEM = `You are a journal research agent with tools.
Use tools to answer questions about the user's private journals.
Tools: search_journals, list_journals (newest first, paginate with cursor), get_journal.
Prefer tools over guessing. When you have enough evidence, give a final answer without more tool calls.
Reference date in this universe: ${buildProbeFixture().referenceDateISO}.`;

export const E2_Q1 =
    'I cataloged a rare fountain pen with a private code that looked like zephyr-something. '
    + 'What was that exact catalog token and what did I write about it?';

export const E2_Q2 =
    'What was my very first journal entry? Quote the title and opening lines.';

export interface ToolCallEvent {
    round: number;
    name: string;
    rawArgs: string;
    malformed: boolean;
    resultPreview: string;
    needleInResult: boolean;
}

export interface E2QuestionRun {
    model: string;
    questionId: 'Q1_semantic' | 'Q2_list_only';
    question: string;
    targetNeedle: string;
    httpStatuses: number[];
    rounds: number;
    toolCalls: ToolCallEvent[];
    malformedArgEvents: number;
    needleAppearedInToolResult: boolean;
    finalAnswer: string;
    finalAnswerLooksCorrect: boolean | 'soft_unscored_error';
    perRoundUsage: (ChatUsage | null)[];
    totalPromptTokens: number;
    totalCompletionTokens: number;
    wallTimeMs: number;
    error?: string;
    errorTaxonomy?: string;
    transcript: string;
}

function softCorrect(
    questionId: 'Q1_semantic' | 'Q2_list_only',
    answer: string,
    fixture: ProbeFixture,
): boolean {
    const lower = answer.toLowerCase();
    if (questionId === 'Q1_semantic') {
        return lower.includes(SEMANTIC_NEEDLE_TOKEN.toLowerCase());
    }
    const first = fixture.entries.find((e) => e.isListOnlyNeedle);
    if (!first) return false;
    return (
        lower.includes(first.title.toLowerCase())
        || lower.includes('starting out')
        || lower.includes('first day trying')
        || lower.includes(first.dateISO)
    );
}

async function runQuestion(
    model: string,
    questionId: 'Q1_semantic' | 'Q2_list_only',
    question: string,
    fixture: ProbeFixture,
    env: { apiKey: string; apiBaseUrl: string },
): Promise<E2QuestionRun> {
    const targetNeedle = questionId === 'Q1_semantic'
        ? SEMANTIC_NEEDLE_TOKEN
        : fixture.listOnlyNeedleId;

    const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: question },
    ];

    const toolCalls: ToolCallEvent[] = [];
    const httpStatuses: number[] = [];
    const perRoundUsage: (ChatUsage | null)[] = [];
    let rounds = 0;
    let needleAppeared = false;
    let malformedArgEvents = 0;
    let finalAnswer = '';
    let error: string | undefined;
    let errorTaxonomy: string | undefined;
    const t0 = Date.now();
    const transcriptLines: string[] = [
        `MODEL: ${model}`,
        `QUESTION (${questionId}): ${question}`,
        `TARGET: ${targetNeedle}`,
        '---',
    ];

    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
        rounds = round;
        const res = await chatCompletion({
            model,
            messages,
            tools: PROBE_TOOL_SPECS,
            tool_choice: 'auto',
            max_tokens: 800,
            apiKey: env.apiKey,
            apiBaseUrl: env.apiBaseUrl,
        });
        httpStatuses.push(res.status);
        perRoundUsage.push(res.usage);
        transcriptLines.push(
            `ROUND ${round} HTTP ${res.status} taxonomy=${res.errorTaxonomy} usage=${JSON.stringify(res.usage)}`,
        );

        if (!res.ok) {
            error = res.rawText.slice(0, 1200);
            errorTaxonomy = res.errorTaxonomy;
            transcriptLines.push(`ERROR BODY:\n${error}`);
            finalAnswer = '';
            break;
        }

        const assistant = extractAssistantMessage(res.body);
        transcriptLines.push(
            `ASSISTANT content: ${assistant.content || '(empty)'}`,
            `ASSISTANT tool_calls: ${JSON.stringify(assistant.tool_calls, null, 2)}`,
        );

        if (!assistant.tool_calls.length) {
            finalAnswer = assistant.content;
            messages.push({ role: 'assistant', content: assistant.content });
            break;
        }

        messages.push({
            role: 'assistant',
            content: assistant.content || null,
            tool_calls: assistant.tool_calls,
        });

        for (const tc of assistant.tool_calls) {
            const executed = executeProbeTool(fixture, tc.function.name, tc.function.arguments);
            if (executed.malformed) malformedArgEvents += 1;
            const needleInResult = executed.content.includes(SEMANTIC_NEEDLE_TOKEN)
                || executed.content.includes(fixture.listOnlyNeedleId)
                || (questionId === 'Q2_list_only'
                    && fixture.entries.some(
                        (e) => e.isListOnlyNeedle && executed.content.includes(e.dateISO)
                            && executed.content.includes(e.title),
                    ));
            if (needleInResult) needleAppeared = true;
            // Stricter HARD check per question:
            const hardNeedle = questionId === 'Q1_semantic'
                ? executed.content.includes(SEMANTIC_NEEDLE_TOKEN)
                : (() => {
                    const first = fixture.entries.find((e) => e.isListOnlyNeedle);
                    return !!first && (
                        executed.content.includes(first.id)
                        || (executed.content.includes(first.dateISO)
                            && executed.content.includes(first.title))
                        || executed.content.includes('First day trying this journal')
                    );
                })();
            if (hardNeedle) needleAppeared = true;

            toolCalls.push({
                round,
                name: tc.function.name,
                rawArgs: tc.function.arguments,
                malformed: executed.malformed,
                resultPreview: executed.content.slice(0, 400),
                needleInResult: hardNeedle,
            });
            transcriptLines.push(
                `TOOL ${tc.function.name} args=${tc.function.arguments}`,
                `TOOL result (preview): ${executed.content.slice(0, 500)}`,
                `HARD needleInResult=${hardNeedle}`,
            );
            messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.function.name,
                content: executed.content,
            });
        }

        if (round === MAX_ROUNDS) {
            finalAnswer = assistant.content || '(hit max rounds without final text-only turn)';
            transcriptLines.push('HIT MAX ROUNDS');
        }
    }

    const totalPromptTokens = perRoundUsage.reduce(
        (s, u) => s + (typeof u?.prompt_tokens === 'number' ? u.prompt_tokens : 0),
        0,
    );
    const totalCompletionTokens = perRoundUsage.reduce(
        (s, u) => s + (typeof u?.completion_tokens === 'number' ? u.completion_tokens : 0),
        0,
    );

    const finalAnswerLooksCorrect = error
        ? 'soft_unscored_error'
        : softCorrect(questionId, finalAnswer, fixture);

    transcriptLines.push('--- FINAL ---', finalAnswer, `SOFT correct=${finalAnswerLooksCorrect}`);

    return {
        model,
        questionId,
        question,
        targetNeedle,
        httpStatuses,
        rounds,
        toolCalls,
        malformedArgEvents,
        needleAppearedInToolResult: needleAppeared,
        finalAnswer,
        finalAnswerLooksCorrect,
        perRoundUsage,
        totalPromptTokens,
        totalCompletionTokens,
        wallTimeMs: Date.now() - t0,
        error,
        errorTaxonomy,
        transcript: transcriptLines.join('\n'),
    };
}

export async function runE2(): Promise<{
    runs: E2QuestionRun[];
    matrix: unknown[];
    flashTranscripts: string;
    bestTranscripts: string;
}> {
    const env = applyProbeEnv();
    const fixture = buildProbeFixture();
    const models = [...ROSTER_VERBATIM.probeSelection.e2];
    const runs: E2QuestionRun[] = [];

    for (const model of models) {
        for (const [qid, q] of [
            ['Q1_semantic', E2_Q1],
            ['Q2_list_only', E2_Q2],
        ] as const) {
            // eslint-disable-next-line no-console
            console.log(`[E2] ${model} ${qid}…`);
            const run = await runQuestion(model, qid, q, fixture, env);
            runs.push(run);
            writeArtifact(
                `e2-transcript-${model.replace(/[/:]/g, '_')}-${qid}.txt`,
                run.transcript,
            );
        }
    }

    const matrix = runs.map((r) => ({
        model: r.model,
        questionId: r.questionId,
        httpStatuses: r.httpStatuses,
        rounds: r.rounds,
        toolCallCount: r.toolCalls.length,
        toolCalls: r.toolCalls.map((t) => ({
            round: t.round,
            name: t.name,
            rawArgs: t.rawArgs,
            malformed: t.malformed,
            needleInResult: t.needleInResult,
        })),
        malformedArgEvents: r.malformedArgEvents,
        needleAppearedInToolResult: r.needleAppearedInToolResult,
        finalAnswerLooksCorrect: r.finalAnswerLooksCorrect,
        totalPromptTokens: r.totalPromptTokens,
        totalCompletionTokens: r.totalCompletionTokens,
        wallTimeMs: r.wallTimeMs,
        errorTaxonomy: r.errorTaxonomy ?? null,
        errorPreview: r.error?.slice(0, 300) ?? null,
    }));

    writeJsonArtifact('e2-behavioral-matrix.json', {
        experiment: 'E2_BEHAVIORAL_TOOL_HARNESS',
        fixtureMeta: {
            entryCount: fixture.entries.length,
            semanticNeedleId: fixture.semanticNeedleId,
            listOnlyNeedleId: fixture.listOnlyNeedleId,
            referenceDateISO: fixture.referenceDateISO,
        },
        matrix,
        note: 'Keyword search is deliberately crude; E3 tests embedding rank.',
    });

    const flashModel = ROSTER_VERBATIM.probeSelection.flashRequired;
    const flashRuns = runs.filter((r) => r.model === flashModel);
    const flashTranscripts = flashRuns.map((r) => r.transcript).join('\n\n====\n\n');
    writeArtifact('e2-flash-transcripts.txt', flashTranscripts);

    // Best performer: most HARD needle hits, then soft correct, then fewest tokens.
    const byModel = new Map<string, E2QuestionRun[]>();
    for (const r of runs) {
        const list = byModel.get(r.model) ?? [];
        list.push(r);
        byModel.set(r.model, list);
    }
    let bestModel: string = flashModel;
    let bestScore = -Infinity;
    for (const [model, list] of byModel) {
        const score = list.reduce((s, r) => {
            let pts = 0;
            if (r.needleAppearedInToolResult) pts += 10;
            if (r.finalAnswerLooksCorrect === true) pts += 3;
            if (r.error) pts -= 5;
            pts -= r.wallTimeMs / 1_000_000;
            return s + pts;
        }, 0);
        if (score > bestScore) {
            bestScore = score;
            bestModel = model;
        }
    }
    const bestTranscripts = runs
        .filter((r) => r.model === bestModel)
        .map((r) => r.transcript)
        .join('\n\n====\n\n');
    writeArtifact(
        `e2-best-transcripts-${bestModel.replace(/[/:]/g, '_')}.txt`,
        bestTranscripts,
    );
    writeJsonArtifact('e2-best-model.json', { bestModel, bestScore });

    return { runs, matrix, flashTranscripts, bestTranscripts };
}
