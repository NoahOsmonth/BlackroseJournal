/**
 * Local schema validation + repair for tool calls (no second LLM round-trip).
 * 2026 agent pattern: structured calls first, repair args, then execute;
 * text dumps are only a degraded source of candidate calls.
 */

import { HISTORY_TOOL_DEFINITIONS } from './definitions';
import type { ToolCall, ToolDefinition, ToolJsonSchema } from './types';

export type ToolCallOrigin = 'structured' | 'text';

export interface PreparedToolCall extends ToolCall {
    origin: ToolCallOrigin;
    repaired: boolean;
}

export interface PrepareToolCallsResult {
    calls: PreparedToolCall[];
    repairedCount: number;
    skippedInvalid: number;
    skippedDuplicate: number;
}

const DEF_BY_NAME = new Map(
    HISTORY_TOOL_DEFINITIONS.map((d) => [d.name, d] as const)
);

/** Common free-model arg aliases → canonical property names. */
const ARG_ALIASES: Record<string, string> = {
    day: 'date',
    day_key: 'date',
    date_key: 'date',
    when: 'date',
    q: 'query',
    search: 'query',
    search_query: 'query',
    term: 'query',
    keywords: 'query',
    topic: 'query',
    entry_id: 'id',
    session_id: 'id',
    conversation_id: 'id',
    checkin_id: 'id',
    title: 'titleQuery',
    title_query: 'titleQuery',
    type: 'kind',
    source: 'kind',
    source_kind: 'kind',
    remember: 'query',
    memory: 'query',
    recall: 'query',
    recollection: 'query',
    remember_when: 'query',
    hits: 'limit',
    results: 'limit',
    num_results: 'limit',
    n: 'days',
    count: 'days',
    limit_days: 'days',
    max: 'limit',
    max_hits: 'limit',
    start: 'from',
    start_date: 'from',
    end: 'to',
    end_date: 'to',
    goal_title: 'title',
    goalName: 'title',
    goalType: 'type',
};

const KIND_ALIASES: Record<string, string> = {
    journal: 'journal_entry',
    journal_entry: 'journal_entry',
    entry: 'journal_entry',
    checkin: 'intention_checkin',
    check_in: 'intention_checkin',
    intention: 'intention_checkin',
    intention_checkin: 'intention_checkin',
    ritual: 'intention_checkin',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseArgsObject(raw: string): Record<string, unknown> {
    if (!raw || !raw.trim()) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (isRecord(parsed)) return { ...parsed };
        if (typeof parsed === 'string' && parsed.trim()) {
            return { _raw: parsed.trim() };
        }
        return {};
    } catch {
        return { _raw: raw };
    }
}

function coerceNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value.trim());
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

function coerceString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return undefined;
}

function normalizeKeys(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        if (key === '_raw') {
            out._raw = value;
            continue;
        }
        const canonical = ARG_ALIASES[key] ?? ARG_ALIASES[key.toLowerCase()] ?? key;
        if (out[canonical] === undefined) {
            out[canonical] = value;
        }
    }
    return out;
}

function promoteRaw(args: Record<string, unknown>, schema: ToolJsonSchema): Record<string, unknown> {
    const raw = coerceString(args._raw)?.trim();
    if (!raw) {
        const { _raw: _, ...rest } = args;
        return rest;
    }
    const next = { ...args };
    delete next._raw;

    const required = schema.required ?? [];
    const props = schema.properties ?? {};

    // Prefer filling the first missing required string field.
    for (const key of required) {
        if (next[key] === undefined || next[key] === null || next[key] === '') {
            const prop = props[key];
            if (isRecord(prop) && prop.type === 'string') {
                next[key] = raw;
                return next;
            }
        }
    }

    // Common single-field tools
    if (props.date && next.date === undefined) next.date = raw;
    else if (props.query && next.query === undefined) next.query = raw;
    else if (props.id && next.id === undefined) next.id = raw;

    return next;
}

function applyPropertyTypes(
    args: Record<string, unknown>,
    schema: ToolJsonSchema
): Record<string, unknown> {
    const props = schema.properties ?? {};
    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
        const prop = props[key];
        if (!isRecord(prop)) {
            if (schema.additionalProperties !== false) {
                out[key] = value;
            }
            continue;
        }

        const type = prop.type;
        if (type === 'number' || type === 'integer') {
            const n = coerceNumber(value);
            if (n !== undefined) {
                out[key] = type === 'integer' ? Math.trunc(n) : n;
            }
            continue;
        }
        if (type === 'string') {
            let s = coerceString(value);
            if (s === undefined) continue;
            if (key === 'kind') {
                const mapped = KIND_ALIASES[s.toLowerCase().replace(/\s+/g, '_')];
                if (mapped) s = mapped;
            }
            if (Array.isArray(prop.enum) && prop.enum.length > 0) {
                if (!prop.enum.includes(s)) {
                    // try case-insensitive enum match
                    const hit = prop.enum.find(
                        (e) => typeof e === 'string' && e.toLowerCase() === s!.toLowerCase()
                    );
                    if (typeof hit === 'string') s = hit;
                    else continue; // drop invalid enum
                }
            }
            out[key] = s;
            continue;
        }
        if (type === 'boolean') {
            if (typeof value === 'boolean') out[key] = value;
            else if (value === 'true' || value === '1') out[key] = true;
            else if (value === 'false' || value === '0') out[key] = false;
            continue;
        }
        out[key] = value;
    }

    // Defaults for optional numeric fields used by our tools
    if (props.days && out.days === undefined) {
        // leave undefined — handler defaults to 7
    }
    if (props.limit && out.limit === undefined) {
        // leave undefined — handler defaults
    }

    return out;
}

function missingRequired(args: Record<string, unknown>, schema: ToolJsonSchema): string[] {
    const required = schema.required ?? [];
    return required.filter((key) => {
        const v = args[key];
        return v === undefined || v === null || v === '';
    });
}

/**
 * Validate + repair a single tool call against the registered schema.
 * Returns null when the call cannot be made safe/valid.
 */
export function validateAndRepairToolCall(
    call: ToolCall,
    origin: ToolCallOrigin = 'structured'
): PreparedToolCall | null {
    const def: ToolDefinition | undefined = DEF_BY_NAME.get(call.name);
    if (!def) return null;

    const originalRaw = call.arguments;
    let args = parseArgsObject(call.arguments);
    args = normalizeKeys(args);

    // create_goal: the global title→titleQuery alias (for get_conversation)
    // would rename a goal title; restore it here. Also accept goalType.
    if (call.name === 'create_goal') {
        if (args.titleQuery !== undefined && args.title === undefined) {
            args.title = args.titleQuery;
            delete args.titleQuery;
        }
        if (args.goalType !== undefined && args.type === undefined) {
            args.type = args.goalType;
            delete args.goalType;
        }
    }

    args = promoteRaw(args, def.parameters);
    args = applyPropertyTypes(args, def.parameters);

    // get_conversation: need id OR (date + titleQuery)
    if (call.name === 'get_conversation') {
        const hasId = typeof args.id === 'string' && args.id.trim().length > 0;
        const hasTitle =
            typeof args.titleQuery === 'string' && args.titleQuery.trim().length > 0
            && typeof args.date === 'string' && args.date.trim().length > 0;
        if (!hasId && !hasTitle) return null;
    }

    const missing = missingRequired(args, def.parameters);
    if (missing.length > 0) return null;

    const repairedArgs = JSON.stringify(args);
    const repaired = repairedArgs !== (originalRaw?.trim() || '{}');

    return {
        id: call.id,
        name: call.name,
        arguments: repairedArgs,
        origin,
        repaired,
    };
}

export function toolCallDedupeKey(call: ToolCall): string {
    let argsKey = call.arguments?.trim() || '{}';
    try {
        const parsed = JSON.parse(argsKey) as unknown;
        if (isRecord(parsed)) {
            const sorted: Record<string, unknown> = {};
            for (const k of Object.keys(parsed).sort()) {
                sorted[k] = parsed[k];
            }
            argsKey = JSON.stringify(sorted);
        }
    } catch {
        // keep raw
    }
    return `${call.name}::${argsKey}`;
}

/**
 * Validate, repair, and dedupe tool calls (within this batch and optional history).
 */
export function prepareToolCalls(
    candidates: readonly { call: ToolCall; origin: ToolCallOrigin }[],
    alreadyExecuted: ReadonlySet<string> = new Set()
): PrepareToolCallsResult {
    const calls: PreparedToolCall[] = [];
    const seen = new Set<string>(alreadyExecuted);
    let repairedCount = 0;
    let skippedInvalid = 0;
    let skippedDuplicate = 0;

    for (const { call, origin } of candidates) {
        const prepared = validateAndRepairToolCall(call, origin);
        if (!prepared) {
            skippedInvalid += 1;
            continue;
        }
        const key = toolCallDedupeKey(prepared);
        if (seen.has(key)) {
            skippedDuplicate += 1;
            continue;
        }
        seen.add(key);
        if (prepared.repaired) repairedCount += 1;
        calls.push(prepared);
    }

    return { calls, repairedCount, skippedInvalid, skippedDuplicate };
}
