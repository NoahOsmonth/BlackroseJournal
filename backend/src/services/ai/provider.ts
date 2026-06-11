/**
 * PR3 — Provider<ChatRequest, ChatResponse> interface and factory.
 *
 * v1 has exactly one provider (`openai-compat`). The factory returns it
 * for every well-known profile (`default`, `fast`) and falls back to it
 * for unknown names with a one-time warn so a future typo doesn't crash
 * the runtime.
 */
import { getAiConfig, loadConfig, type AiConfig } from '../../config/ai';
import { OPENAI_COMPAT_DEFAULT_CAPABILITIES, type Capabilities } from './capabilities';
import { openaiCompatChat, openaiCompatStream } from './adapters/openaiCompat';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatRequest {
    messages: ChatMessage[];
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    stream?: boolean;
    signal?: AbortSignal;
}

export interface ChatResponse {
    content: string;
    reasoning: string;
    raw: unknown;
}

export interface ResolvedProfile {
    apiBaseUrl: string;
    apiKey: string;
    model: string;
    flashModel: string;
    capabilities: Capabilities;
}

export interface Provider {
    readonly id: string;
    readonly capabilities: Capabilities;
    resolveProfile(profileName: 'default' | 'fast' | string): ResolvedProfile;
    chat(req: ChatRequest, profile: ResolvedProfile): Promise<ChatResponse>;
    stream(req: ChatRequest, profile: ResolvedProfile): Promise<Response>;
}

export type ProfileName = 'default' | 'fast' | string;

const FALLTHROUGH_WARN_FLAG = Symbol.for('blackrose.ai.fallthroughWarned');
type WarnCarrier = { [FALLTHROUGH_WARN_FLAG]?: boolean };

function warnUnknownProfileOnce(profileName: string): void {
    const g = globalThis as unknown as WarnCarrier;
    if (g[FALLTHROUGH_WARN_FLAG]) {
        return;
    }
    g[FALLTHROUGH_WARN_FLAG] = true;
    console.warn(
        `[ai] Unknown profile "${profileName}" requested; falling back to the default provider. ` +
            `Known profiles in v1: "default", "fast". This warning fires at most once per process.`
    );
}

export function __resetProfileWarnForTests(): void {
    const g = globalThis as unknown as WarnCarrier;
    delete g[FALLTHROUGH_WARN_FLAG];
}

function modelForProfile(profileName: ProfileName, config: AiConfig): string {
    return profileName === 'fast' ? config.flashModel : config.model;
}

function buildOpenaiCompatProvider(): Provider {
    return {
        id: 'openai-compat',
        capabilities: OPENAI_COMPAT_DEFAULT_CAPABILITIES,
        resolveProfile(profileName: ProfileName): ResolvedProfile {
            const config = getAiConfig();
            return {
                apiBaseUrl: config.apiBaseUrl,
                apiKey: config.apiKey,
                model: modelForProfile(profileName, config),
                flashModel: config.flashModel,
                capabilities: OPENAI_COMPAT_DEFAULT_CAPABILITIES,
            };
        },
        async chat(req: ChatRequest, profile: ResolvedProfile): Promise<ChatResponse> {
            return openaiCompatChat(req, profile);
        },
        async stream(req: ChatRequest, profile: ResolvedProfile): Promise<Response> {
            return openaiCompatStream(req, profile);
        },
    };
}

const KNOWN_PROFILES = new Set<string>(['default', 'fast']);
const PROVIDER = buildOpenaiCompatProvider();

export function getProviderForProfile(profileName: ProfileName): Provider {
    if (!KNOWN_PROFILES.has(profileName)) {
        warnUnknownProfileOnce(profileName);
    }
    return PROVIDER;
}

export { loadConfig };
