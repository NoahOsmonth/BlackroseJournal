import {
    clearToolsUnsupportedCache,
    isMarkedToolsUnsupported,
    markToolsUnsupported,
    resolveManagedToolCapability,
    resolveToolCapability,
} from '../../../services/ai/tools/toolCapability';

describe('resolveToolCapability', () => {
    beforeEach(() => {
        clearToolsUnsupportedCache();
    });

    it('marks free hy3 as hybrid (tools + text dump fallback)', () => {
        const cap = resolveToolCapability('tencent/hy3:free');
        expect(cap.mode).toBe('hybrid');
        expect(cap.runAgentLoop).toBe(true);
        expect(cap.sendToolsInApi).toBe(true);
        expect(cap.parseTextToolDumps).toBe(true);
        expect(cap.preferTextResultProtocol).toBe(true);
    });

    it('routes on the model, not the price tag (OmniRoute serves strong :free models)', () => {
        // Opus/Sonnet on a free route still deliver native structured tool_calls.
        const opus = resolveToolCapability('auto/claude-opus:free');
        expect(opus.mode).toBe('structured');
        expect(opus.preferTextResultProtocol).toBe(false);
        expect(resolveToolCapability('auto/gemini:free').mode).toBe('structured');
        expect(resolveToolCapability('op-router/z-ai/glm-5.2:free').mode).toBe('hybrid');
    });

    it('keeps weak free routes hybrid even when the name looks strong', () => {
        // "glm-5.3-flash" is a strong name on a route that dumps tool syntax as text.
        expect(resolveToolCapability('merge/zai/glm-5.3-flash').mode).toBe('hybrid');
        expect(resolveToolCapability('cl/dots-studio/dots-3-note-preview:free').mode).toBe('hybrid');
    });

    it('routes the current default deepseek-v4 route as structured', () => {
        // Probed live 2026-09-11: native tool_calls, correct role:tool round-trip,
        // native response_format json_object — no text-dump repair needed.
        const cap = resolveToolCapability('merge/deepseek/deepseek-v4-flash-0731');
        expect(cap.mode).toBe('structured');
        expect(cap.preferTextResultProtocol).toBe(false);
    });

    it('marks strong models as structured', () => {
        const cap = resolveToolCapability('openai/gpt-4o-mini');
        expect(cap.mode).toBe('structured');
        expect(cap.preferTextResultProtocol).toBe(false);
        expect(cap.parseTextToolDumps).toBe(true);
    });

    it('marks inject-only tiny models', () => {
        const cap = resolveToolCapability('tinyllama-1.1b');
        expect(cap.mode).toBe('inject_only');
        expect(cap.runAgentLoop).toBe(false);
        expect(cap.sendToolsInApi).toBe(false);
    });

    it('remembers provider tool rejection', () => {
        markToolsUnsupported('some/custom-model');
        expect(isMarkedToolsUnsupported('some/custom-model')).toBe(true);
        const cap = resolveToolCapability('some/custom-model');
        expect(cap.mode).toBe('inject_only');
    });

    it('defaults agent-default to hybrid', () => {
        expect(resolveToolCapability('agent-default').mode).toBe('hybrid');
        expect(resolveToolCapability(undefined).mode).toBe('hybrid');
    });

    it('honors the managed catalog tool capability instead of model-name guessing', () => {
        expect(resolveManagedToolCapability('openai/gpt-5', false).mode).toBe('inject_only');
        expect(resolveManagedToolCapability('openai/gpt-5', true).mode).toBe('structured');
    });
});
