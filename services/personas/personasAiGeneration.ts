/**
 * AI persona generation
 *
 * Turns a short free-text description into a `PersonaCreateInput` via a single
 * non-streaming `completeChat` call that returns strict JSON. All parsing is
 * defensive (mirroring `services/ai/insights.ts`): malformed JSON, missing
 * fields, out-of-range imagination, and unknown voices are clamped or replaced
 * with sensible defaults. This function NEVER throws to the UI — on any AI or
 * parse failure it returns a usable fallback persona seeded from the
 * description.
 */

import { completeChat } from '@/services/ai/ai';
import { DEFAULT_PERSONA_MODEL } from '@/constants/aiModels';
import { DEFAULT_PERSONA_VOICE } from '@/constants/personas';
import type { PersonaCreateInput } from './personasStorage.types';

const GENERATION_SYSTEM_PROMPT = `You design a journaling companion persona.
Given the user's description, return STRICT JSON with this EXACT shape:
{
  "name": string,
  "tagline": string,
  "prompt": string,
  "voice": string,
  "imagination": number
}

Rules:
- name: 1-3 words, the companion's name.
- tagline: a short phrase (<= 8 words) capturing the vibe.
- prompt: a 2nd-person system prompt ("You are...") describing tone, values,
  and how to respond in a reflective journaling chat. 2-5 sentences.
- voice: one of the allowed voices listed by the user.
- imagination: integer 0-100 (lower = consistent, higher = creative).
- Output ONLY the JSON object. No prose, no code fences.`;

export interface GeneratePersonaInput {
    /** Free-text description, e.g. "a calm stoic mentor who asks short questions". */
    description: string;
    /** Allowed TTS voices the generated persona may use. */
    allowedVoices: string[];
}

interface ParsedPersona {
    name: string;
    tagline: string;
    prompt: string;
    voice: string;
    imagination: number;
}

/** Strips Markdown code fences the model may wrap JSON in. */
function stripCodeFences(text: string): string {
    return text
        .replace(/```(?:json)?/gi, '')
        .replace(/```/g, '')
        .trim();
}

/** Extracts the first balanced top-level JSON object from arbitrary text. */
function extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '{') depth += 1;
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

function clampImagination(value: unknown): number {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return 50;
    return Math.min(100, Math.max(0, Math.round(num)));
}

function coerceVoice(value: unknown, allowedVoices: string[]): string {
    const allowed = allowedVoices.length > 0 ? allowedVoices : [DEFAULT_PERSONA_VOICE];
    if (typeof value === 'string') {
        const match = allowed.find((v) => v.toLowerCase() === value.trim().toLowerCase());
        if (match) return match;
    }
    return allowed[0];
}

function coerceString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
    }
    return fallback;
}

/** Builds a sensible fallback persona when the AI output is unusable. */
function fallbackPersona(description: string, allowedVoices: string[]): ParsedPersona {
    const trimmed = description.trim();
    return {
        name: 'New Guide',
        tagline: trimmed ? trimmed.slice(0, 48) : 'A thoughtful journaling companion',
        prompt:
            'You are a warm, attentive journaling companion. Reflect back what you '
            + 'hear, ask gentle open-ended questions, and help the user explore their '
            + 'thoughts without judgment.',
        voice: coerceVoice(undefined, allowedVoices),
        imagination: 50,
    };
}

/**
 * Defensively parses the model's JSON output into a validated persona draft.
 * Returns the fallback persona if parsing fails or required fields are missing.
 */
export function safeParsePersonaJson(
    raw: string,
    description: string,
    allowedVoices: string[]
): ParsedPersona {
    const fallback = fallbackPersona(description, allowedVoices);
    const candidate = extractFirstJsonObject(stripCodeFences(raw));
    if (!candidate) return fallback;

    let data: Record<string, unknown>;
    try {
        const parsed = JSON.parse(candidate);
        if (!parsed || typeof parsed !== 'object') return fallback;
        data = parsed as Record<string, unknown>;
    } catch {
        return fallback;
    }

    return {
        name: coerceString(data.name, fallback.name),
        tagline: coerceString(data.tagline, fallback.tagline),
        prompt: coerceString(data.prompt, fallback.prompt),
        voice: coerceVoice(data.voice, allowedVoices),
        imagination: clampImagination(data.imagination),
    };
}

export async function generatePersonaWithAI(
    input: GeneratePersonaInput
): Promise<PersonaCreateInput> {
    let content = '';
    try {
        const result = await completeChat(
            [
                {
                    id: '1',
                    role: 'user',
                    content: `Allowed voices: ${input.allowedVoices.join(', ')}\n\nDescription:\n${input.description}`,
                    timestamp: Date.now(),
                },
            ],
            GENERATION_SYSTEM_PROMPT
        );
        content = result.content;
    } catch {
        // Swallow transport errors — safeParsePersonaJson falls back below.
        content = '';
    }

    const parsed = safeParsePersonaJson(content, input.description, input.allowedVoices);
    return {
        name: parsed.name,
        tagline: parsed.tagline,
        prompt: parsed.prompt,
        voice: parsed.voice,
        model: DEFAULT_PERSONA_MODEL,
        imagination: parsed.imagination,
        avatarKey: 'persona-new',
    };
}
