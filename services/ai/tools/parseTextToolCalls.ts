/**
 * Free / small models often "call" tools by writing function syntax into
 * assistant content instead of the OpenAI `tool_calls` field. Parse those
 * dumps so the agent loop can execute them and keep the raw code off the UI.
 */

import { HISTORY_TOOL_DEFINITIONS } from './definitions';
import type { ToolCall } from './types';

const TOOL_NAMES = HISTORY_TOOL_DEFINITIONS.map((d) => d.name);
const TOOL_NAME_RE = TOOL_NAMES.map(escapeRegExp).join('|');

export interface TextToolCallParseResult {
    toolCalls: ToolCall[];
    /** Content with tool-call syntax removed (may be empty). */
    cleanedContent: string;
    /** True when the reply looked like a tool dump even if nothing parsed. */
    lookedLikeToolDump: boolean;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function argsToString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === undefined || value === null) return '{}';
    try {
        return JSON.stringify(value);
    } catch {
        return '{}';
    }
}

/** Best-effort extract of a balanced `{ ... }` starting at `start`. */
function extractBalancedJsonObject(text: string, start: number): { json: string; end: number } | null {
    if (text[start] !== '{') return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (inString) {
            if (escape) {
                escape = false;
            } else if (ch === '\\') {
                escape = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{') depth += 1;
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return { json: text.slice(start, i + 1), end: i + 1 };
            }
        }
    }
    return null;
}

function parseKwargStyleArgs(inner: string): string {
    const trimmed = inner.trim();
    if (!trimmed) return '{}';
    if (trimmed.startsWith('{')) {
        try {
            JSON.parse(trimmed);
            return trimmed;
        } catch {
            // fall through
        }
    }

    const out: Record<string, unknown> = {};
    // key=value or key="value" pairs (comma/space separated)
    const pairRe = /([a-zA-Z_][\w]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s)]+))/g;
    let match: RegExpExecArray | null;
    let found = false;
    while ((match = pairRe.exec(trimmed)) !== null) {
        found = true;
        const key = match[1];
        const raw = match[2] ?? match[3] ?? match[4] ?? '';
        if (raw === 'true') out[key] = true;
        else if (raw === 'false') out[key] = false;
        else if (raw !== '' && !Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw)) {
            out[key] = Number(raw);
        } else {
            out[key] = raw;
        }
    }
    if (found) return JSON.stringify(out);

    // bare string arg → map onto common first param when possible
    if (/^["'].*["']$/.test(trimmed) || !trimmed.includes('=')) {
        const bare = trimmed.replace(/^["']|["']$/g, '');
        if (bare) return JSON.stringify({ _raw: bare, query: bare, date: bare });
    }
    return JSON.stringify({ _raw: trimmed });
}

function pushUnique(
    out: ToolCall[],
    seen: Set<string>,
    name: string,
    args: string,
    idPrefix: string,
    index: number
): void {
    if (!TOOL_NAMES.includes(name)) return;
    const key = `${name}::${args}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
        id: `${idPrefix}_${index}_${name}`,
        name,
        arguments: args || '{}',
    });
}

function parseJsonToolObject(obj: Record<string, unknown>): { name: string; args: string } | null {
    const nameRaw =
        (typeof obj.name === 'string' && obj.name)
        || (typeof obj.tool === 'string' && obj.tool)
        || (typeof obj.function === 'string' && obj.function)
        || (isRecord(obj.function) && typeof obj.function.name === 'string' && obj.function.name)
        || '';
    if (!nameRaw || !TOOL_NAMES.includes(nameRaw)) return null;

    let argsSource: unknown = obj.arguments ?? obj.parameters ?? obj.args ?? obj.input;
    if (argsSource === undefined && isRecord(obj.function)) {
        argsSource = obj.function.arguments ?? obj.function.parameters;
    }
    // If the object is itself args-shaped with a name field only
    if (argsSource === undefined) {
        const { name: _n, tool: _t, function: _f, ...rest } = obj;
        argsSource = Object.keys(rest).length > 0 ? rest : {};
    }
    return { name: nameRaw, args: argsToString(argsSource) };
}

/**
 * Extract tool calls written as plain text / pseudo-code in model content.
 */
export function parseTextToolCalls(content: string, idPrefix = 'text_call'): TextToolCallParseResult {
    if (!content || !content.trim()) {
        return { toolCalls: [], cleanedContent: '', lookedLikeToolDump: false };
    }

    const toolCalls: ToolCall[] = [];
    const seen = new Set<string>();
    let cleaned = content;
    let matchIndex = 0;

    // 1) XML / tag forms: <tool_call name="get_day">{"date":"yesterday"}</tool_call>
    //    also <function=get_day>...</function>, <tool>get_day\n{}</tool>
    const xmlRe = new RegExp(
        `<(?:tool_call|function_call|invoke|tool_request|tool|function)\\b([^>]*)>([\\s\\S]*?)</(?:tool_call|function_call|invoke|tool_request|tool|function)>`,
        'gi'
    );
    cleaned = cleaned.replace(xmlRe, (full, attrs: string, body: string) => {
        const attrName =
            /(?:name|function)\s*=\s*["']?([a-zA-Z_][\w]*)["']?/i.exec(attrs)?.[1]
            ?? '';
        const bodyTrim = body.trim();
        const bodyNameMatch = new RegExp(`^(${TOOL_NAME_RE})\\b`, 'i').exec(bodyTrim);
        const name = attrName || bodyNameMatch?.[1] || '';
        if (!name || !TOOL_NAMES.includes(name)) return full;

        let args = '{}';
        const jsonStart = bodyTrim.indexOf('{');
        if (jsonStart >= 0) {
            const bal = extractBalancedJsonObject(bodyTrim, jsonStart);
            if (bal) args = bal.json;
        } else if (bodyNameMatch) {
            const after = bodyTrim.slice(bodyNameMatch[0].length).trim();
            if (after) args = parseKwargStyleArgs(after);
        }
        pushUnique(toolCalls, seen, name, args, idPrefix, matchIndex);
        matchIndex += 1;
        return '\n';
    });

    // 2) Qwen / Hermes fence blocks:
    //    tool_call\nget_day\n{"date":"yesterday"}\n
    //    or ```tool_call ... ```
    const fenceRe = /```(?:tool_call|function_call|json|tool)?\s*([\s\S]*?)```/gi;
    cleaned = cleaned.replace(fenceRe, (full, body: string) => {
        const trimmed = body.trim();
        // JSON object(s) inside fence
        if (trimmed.startsWith('{')) {
            try {
                const parsed: unknown = JSON.parse(trimmed);
                const obj = Array.isArray(parsed) ? null : isRecord(parsed) ? parsed : null;
                if (obj) {
                    const call = parseJsonToolObject(obj);
                    if (call) {
                        pushUnique(toolCalls, seen, call.name, call.args, idPrefix, matchIndex);
                        matchIndex += 1;
                        return '\n';
                    }
                }
            } catch {
                // try line form below
            }
        }
        const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const nameLine = lines.find((l) => TOOL_NAMES.includes(l));
        if (nameLine) {
            const rest = lines.filter((l) => l !== nameLine).join('\n');
            let args = '{}';
            const jsonStart = rest.indexOf('{');
            if (jsonStart >= 0) {
                const bal = extractBalancedJsonObject(rest, jsonStart);
                if (bal) args = bal.json;
            }
            pushUnique(toolCalls, seen, nameLine, args, idPrefix, matchIndex);
            matchIndex += 1;
            return '\n';
        }
        return full;
    });

    // 3) Inline JSON tool objects: {"name":"get_day","arguments":{...}}
    {
        let searchFrom = 0;
        while (searchFrom < cleaned.length) {
            const start = cleaned.indexOf('{', searchFrom);
            if (start < 0) break;
            const bal = extractBalancedJsonObject(cleaned, start);
            if (!bal) {
                searchFrom = start + 1;
                continue;
            }
            try {
                const parsed: unknown = JSON.parse(bal.json);
                if (isRecord(parsed)) {
                    const call = parseJsonToolObject(parsed);
                    if (call) {
                        pushUnique(toolCalls, seen, call.name, call.args, idPrefix, matchIndex);
                        matchIndex += 1;
                        cleaned = `${cleaned.slice(0, start)}\n${cleaned.slice(bal.end)}`;
                        searchFrom = start;
                        continue;
                    }
                }
            } catch {
                // not json
            }
            searchFrom = start + 1;
        }
    }

    // 4) Function-call style: get_day({"date":"yesterday"}) / get_clock() / get_day(date="yesterday")
    const fnRe = new RegExp(`\\b(${TOOL_NAME_RE})\\s*\\(([^)]*)\\)`, 'g');
    cleaned = cleaned.replace(fnRe, (full, name: string, inner: string) => {
        const args = parseKwargStyleArgs(inner ?? '');
        pushUnique(toolCalls, seen, name, args, idPrefix, matchIndex);
        matchIndex += 1;
        return '\n';
    });

    // 5) "call tool get_day with {...}" / "invoke get_day {...}" / "run tool get_clock"
    const invokeRe = new RegExp(
        `\\b(?:call|invoke|run|use)\\s+(?:the\\s+)?(?:tool\\s+)?(${TOOL_NAME_RE})\\b(?:\\s*(?:with|args?|arguments?|parameters?)?\\s*)?`,
        'gi'
    );
    cleaned = cleaned.replace(invokeRe, (full, name: string, offset: number, whole: string) => {
        const afterIdx = offset + full.length;
        let args = '{}';
        const slice = whole.slice(afterIdx);
        const brace = slice.search(/\{/);
        if (brace >= 0 && brace < 80) {
            const bal = extractBalancedJsonObject(slice, brace);
            if (bal) {
                args = bal.json;
                // remove trailing json from cleaned via a second pass — mark only the invoke phrase here
            }
        }
        pushUnique(toolCalls, seen, name, args, idPrefix, matchIndex);
        matchIndex += 1;
        return '\n';
    });

    // Remove leftover invoke-json tails that sat after "call tool X"
    // (already partially handled when args extracted at parse time — re-scan orphan tool-only lines)
    const bareNameLineRe = new RegExp(`^\\s*(?:tool_call|function_call)?\\s*(${TOOL_NAME_RE})\\s*$`, 'gim');
    cleaned = cleaned.replace(bareNameLineRe, (full, name: string) => {
        // Only treat as a call if we already have calls or surrounding dump markers
        if (toolCalls.length > 0 || looksLikeToolDump(content)) {
            pushUnique(toolCalls, seen, name, '{}', idPrefix, matchIndex);
            matchIndex += 1;
            return '\n';
        }
        return full;
    });

    // Strip common leftover scaffolding lines
    cleaned = cleaned
        .replace(/```[\w]*\s*```/g, '\n')
        .replace(/^\s*(?:tool_call|function_call|tool_request|invoke|arguments?)\s*:?\s*$/gim, '\n')
        .replace(/<\/?(?:tool_call|function_call|invoke|tool_request|tool|function)[^>]*>/gi, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const lookedLike = toolCalls.length > 0 || looksLikeToolDump(content);
    return {
        toolCalls,
        cleanedContent: cleaned,
        lookedLikeToolDump: lookedLike,
    };
}

/**
 * Heuristic: content is mostly pseudo-code / tool syntax rather than a user reply.
 */
export function looksLikeToolDump(content: string): boolean {
    const text = content.trim();
    if (!text) return false;
    const lower = text.toLowerCase();
    const hasToolName = TOOL_NAMES.some((n) => lower.includes(n));
    if (!hasToolName) return false;

    const markers = [
        'tool_call',
        'function_call',
        'tool_request',
        'invoke',
        'arguments',
        'parameters',
        '```',
        '<tool',
        '<function',
        'call tool',
        'run tool',
    ];
    const markerHit = markers.some((m) => lower.includes(m));
    const fnHit = new RegExp(`\\b(${TOOL_NAME_RE})\\s*\\(`, 'i').test(text);
    const jsonHit = /"name"\s*:\s*"(get_clock|list_recent_days|get_day|get_conversation|search_history)"/.test(text);

    if (!(markerHit || fnHit || jsonHit)) return false;

    // If there's substantial prose beyond tool syntax, still flag so caller can strip.
    const withoutCode = text
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(new RegExp(`\\b(${TOOL_NAME_RE})\\s*\\([^)]*\\)`, 'g'), ' ')
        .replace(/\{[\s\S]*?\}/g, ' ')
        .replace(/<\/?[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Short residual or residual is mostly punctuation → dump
    if (withoutCode.length < 40) return true;
    // Long message that still leads with tool syntax
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
    if (new RegExp(`^(?:\`\`\`|<|tool_call|function_call|call\\s|invoke\\s|run\\s)`, 'i').test(firstLine.trim())) {
        return true;
    }
    return markerHit && fnHit;
}

/** Strip tool-call pseudo-code from content that should never reach the user. */
export function stripToolCallSyntax(content: string): string {
    if (!content) return '';
    const { cleanedContent, lookedLikeToolDump } = parseTextToolCalls(content, 'strip');
    if (lookedLikeToolDump || cleanedContent !== content.trim()) {
        return cleanedContent;
    }
    return content;
}

/** Format tool results for models that ignore the OpenAI `tool` role. */
export function formatToolResultsForModel(
    results: readonly { name: string; content: string; toolCallId?: string }[]
): string {
    const lines = [
        '[Device tool results — facts from the user\'s phone. Use them; do not invent tool output.]',
        'Reply to the user in natural language only. Do not write function calls, tool XML, JSON tool objects, or code fences.',
        '',
    ];
    for (const r of results) {
        lines.push(`### ${r.name}`);
        lines.push(r.content);
        lines.push('');
    }
    return lines.join('\n').trim();
}
