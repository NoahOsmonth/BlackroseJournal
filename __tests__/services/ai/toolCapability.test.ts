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
