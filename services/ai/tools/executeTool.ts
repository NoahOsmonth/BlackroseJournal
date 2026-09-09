/**
 * Device-side tool executor with 2026 agent-executor discipline:
 *
 * - execClass scheduling (multigrid parallel-tool-calls): pure + reads-mutable
 *   calls run concurrently (capped); at most ONE mutating call runs per step
 *   and extras are REFUSED with an explicit re-request note.
 * - Every input id gets exactly one result; input order is preserved.
 * - Idempotency: sha256(runId + tool + canonical args) dedupes identical
 *   calls within a step without re-executing them.
 * - Error classification: fatal (unknown tool, validation) → terse message +
 *   shape hint, no retry. Retryable (timeout, 429/5xx markers) → N=1 retry for
 *   side-effect-free calls only; mutating calls are never blind-retried
 *   (verify-before-retry: the effect channel may have landed even when the
 *   response channel timed out — the model verifies via a read tool first).
 */

import { getToolDefinition, getToolHandler } from './registry';
import type { ToolCall, ToolExecClass, ToolResult } from './types';

/** Default wall-clock deadline for a single tool execution (Task 9). */
export const TOOL_EXEC_TIMEOUT_MS = 10_000;

/** Max concurrent in-flight read calls per tool step. */
export const TOOL_READ_CONCURRENCY_CAP = 4;

const MAX_RESULT_CHARS = 12_000;

export interface ExecuteToolCallsOptions {
    timeoutMs?: number;
    /** Agent-turn id; scopes idempotency keys so identical calls in a later turn still run. */
    runId?: string;
    /** Override the read-concurrency cap (tests). */
    concurrencyCap?: number;
}

/** sha256 over a small string, implemented locally (no crypto dep on device). */
function sha256Hex(input: string): string {
    const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
        0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
        0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
        0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
        0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    let h0 = 0x6a09e667; let h1 = 0xbb67ae85; let h2 = 0x3c6ef372; let h3 = 0xa54ff53a;
    let h4 = 0x510e527f; let h5 = 0x9b05688c; let h6 = 0x1f83d9ab; let h7 = 0x5be0cd19;

    const bytes: number[] = [];
    for (let i = 0; i < input.length; i += 1) {
        const code = input.charCodeAt(i);
        if (code < 0x80) bytes.push(code);
        else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
        else bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const hi = Math.floor(bitLen / 0x100000000);
    const lo = bitLen >>> 0;
    bytes.push(
        (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
        (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff
    );

    const w = new Array<number>(64);
    const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
    for (let chunk = 0; chunk < bytes.length; chunk += 64) {
        for (let i = 0; i < 16; i += 1) {
            w[i] = (
                (bytes[chunk + i * 4] << 24)
                | (bytes[chunk + i * 4 + 1] << 16)
                | (bytes[chunk + i * 4 + 2] << 8)
                | bytes[chunk + i * 4 + 3]
            ) >>> 0;
        }
        for (let i = 16; i < 64; i += 1) {
            const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
            const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let a = h0; let b = h1; let c = h2; let d = h3;
        let e = h4; let f = h5; let g = h6; let h = h7;
        for (let i = 0; i < 64; i += 1) {
            const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
            const ch = ((e & f) ^ (~e & g)) >>> 0;
            const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
            const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
            const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            const t2 = (S0 + maj) >>> 0;
            h = g; g = f; f = e; e = (d + t1) >>> 0;
            d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const hex = (x: number): string => (`00000000${x.toString(16)}`).slice(-8);
    return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4) + hex(h5) + hex(h6) + hex(h7);
}

function canonicalizeArgs(raw: string): string {
    if (!raw || !raw.trim()) return '{}';
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const sorted: Record<string, unknown> = {};
            for (const k of Object.keys(parsed).sort()) {
                sorted[k] = (parsed as Record<string, unknown>)[k];
            }
            return JSON.stringify(sorted);
        }
        return JSON.stringify(parsed ?? {});
    } catch {
        return JSON.stringify({ _raw: raw });
    }
}

/**
 * Idempotency key for one logical tool op: sha256(runId + tool + canonical args).
 * Same key twice in a turn → the second is a skipped duplicate, never re-run.
 */
export function idempotencyKey(runId: string, name: string, args: string): string {
    return sha256Hex(`${runId}::${name}::${canonicalizeArgs(args)}`);
}

/** Exec class for a tool name; unknown names fail safe as mutating. */
export function execClassOf(name: string): ToolExecClass {
    return getToolDefinition(name)?.execClass ?? 'mutating';
}

function truncate(text: string): string {
    if (text.length <= MAX_RESULT_CHARS) return text;
    return `${text.slice(0, MAX_RESULT_CHARS)}\n…(truncated to 12000 chars — re-call with a narrower query, date, or limit if you need the rest)`;
}

function parseArgs(raw: string): Record<string, unknown> {
    if (!raw || !raw.trim()) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
        return {};
    } catch {
        return { _raw: raw };
    }
}

/**
 * Effect-aware error classification. Fatal errors (unknown tool, validation,
 * 400/422-style shape rejections) get a terse message plus a shape hint and
 * are never retried. Retryable errors (timeouts, 429, 5xx markers) may be
 * retried at most once — and only for side-effect-free calls.
 */
export function classifyToolFailure(content: string): 'retryable' | 'fatal' {
    const lower = content.toLowerCase();
    if (/\b(unknown tool|could not run|missing|invalid|required|422| 400|bad request|validation)\b/.test(lower)) {
        return 'fatal';
    }
    if (/\b(timed out|timeout|timedout|429|too many requests|rate limit|500|502|503|504|unavailable|temporarily)\b/.test(lower)) {
        return 'retryable';
    }
    return 'fatal';
}

/**
 * Race a handler promise against a wall-clock deadline. Never rejects: the
 * resolved value is either the handler's content or a marker string for
 * timeout/failure, which the caller marks isError (Task 9).
 */
function withTimeout(
    promise: Promise<string>,
    name: string,
    timeoutMs: number
): Promise<string> {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            resolve(`[tool:${name}] timed out after ${timeoutMs}ms`);
        }, timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                resolve(`[tool:${name}] failed: ${String(error)}`);
            }
        );
    });
}

function fatalUnknownTool(name: string, id: string): ToolResult {
    return {
        toolCallId: id,
        name,
        content: truncate(
            `Error: unknown tool "${name}". Available: get_clock, list_recent_days, get_day, `
            + 'get_conversation, search_history, recall_memory, get_identity, update_identity, '
            + 'list_goals, create_goal.'
        ),
        isError: true,
    };
}

export async function executeToolCall(
    call: ToolCall,
    opts: { timeoutMs?: number } = {}
): Promise<ToolResult> {
    const handler = getToolHandler(call.name);
    if (!handler) {
        return fatalUnknownTool(call.name, call.id);
    }

    const timeoutMs = opts.timeoutMs ?? TOOL_EXEC_TIMEOUT_MS;
    const execClass = execClassOf(call.name);
    const runOnce = async (): Promise<{ content: string; isError: boolean }> => {
        try {
            const args = parseArgs(call.arguments);
            const content = await withTimeout(handler(args), call.name, timeoutMs);
            const isError = content.startsWith(`[tool:${call.name}]`);
            return { content, isError };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Tool execution failed';
            return { content: `Error: ${message}`, isError: true };
        }
    };

    const first = await runOnce();
    if (!first.isError) {
        return { toolCallId: call.id, name: call.name, content: truncate(first.content) };
    }

    // N=1 retry for retryable failures on side-effect-free calls only.
    // Mutating calls are never blind-retried: the write may have landed even
    // when the response channel failed — the model must verify via a read
    // tool (list_goals / get_identity) before issuing the call again.
    if (classifyToolFailure(first.content) === 'retryable' && execClass !== 'mutating') {
        const second = await runOnce();
        if (!second.isError) {
            return { toolCallId: call.id, name: call.name, content: truncate(second.content) };
        }
        return {
            toolCallId: call.id,
            name: call.name,
            content: truncate(second.content),
            isError: true,
        };
    }

    if (execClass === 'mutating' && /timed out/i.test(first.content)) {
        return {
            toolCallId: call.id,
            name: call.name,
            content: truncate(
                `${first.content} The change may or may not have applied — verify with a `
                + 'read tool (list_goals / get_identity) before retrying; do not repeat blindly.'
            ),
            isError: true,
        };
    }

    return {
        toolCallId: call.id,
        name: call.name,
        content: truncate(first.content),
        isError: true,
    };
}

function refusedResult(call: ToolCall, runningName: string): ToolResult {
    return {
        toolCallId: call.id,
        name: call.name,
        content:
            `REFUSED: "${call.name}" was not run — "${runningName}" is already changing device `
            + 'state in this step, and at most one mutating tool runs per step. Re-request this '
            + 'call alone in your next step if it is still needed.',
        isError: true,
        refused: true,
    };
}

/**
 * Execute a tool batch with exec-class scheduling:
 * phase 1 — pure + reads-mutable run concurrently (capped);
 * phase 2 — at most the first mutating call runs, extras are REFUSED.
 * Identical in-batch calls (same idempotency key) share one execution.
 * Results preserve input order; every input id gets exactly one result.
 */
export async function executeToolCalls(
    calls: readonly ToolCall[],
    opts: ExecuteToolCallsOptions = {}
): Promise<ToolResult[]> {
    const runId = opts.runId ?? `run_${Date.now()}`;
    const cap = Math.max(1, opts.concurrencyCap ?? TOOL_READ_CONCURRENCY_CAP);
    const results: (ToolResult | undefined)[] = new Array(calls.length);
    const inFlight = new Map<string, Promise<ToolResult>>();

    const runShared = (index: number): Promise<ToolResult> => {
        const call = calls[index];
        const key = idempotencyKey(runId, call.name, call.arguments);
        const existing = inFlight.get(key);
        if (existing) {
            return existing.then((prior) => ({ ...prior, toolCallId: call.id }));
        }
        const started = executeToolCall(call, { timeoutMs: opts.timeoutMs });
        inFlight.set(key, started);
        return started;
    };

    const readIndexes: number[] = [];
    const mutatingIndexes: number[] = [];
    calls.forEach((call, index) => {
        if (execClassOf(call.name) === 'mutating') mutatingIndexes.push(index);
        else readIndexes.push(index);
    });

    // Phase 1: reads concurrently, capped.
    const workers: Promise<void>[] = [];
    let cursor = 0;
    const workerCount = Math.min(cap, readIndexes.length);
    for (let w = 0; w < workerCount; w += 1) {
        workers.push((async () => {
            while (cursor < readIndexes.length) {
                const slot = cursor;
                cursor += 1;
                const index = readIndexes[slot];
                results[index] = await runShared(index);
            }
        })());
    }
    await Promise.all(workers);

    // Phase 2: at most one mutating call; refuse the rest.
    if (mutatingIndexes.length > 0) {
        const [first, ...rest] = mutatingIndexes;
        results[first] = await runShared(first);
        const runningName = calls[first].name;
        for (const index of rest) {
            results[index] = refusedResult(calls[index], runningName);
        }
    }

    return results.map((result, index) => result ?? {
        toolCallId: calls[index].id,
        name: calls[index].name,
        content: 'Error: tool was not executed.',
        isError: true,
    });
}
