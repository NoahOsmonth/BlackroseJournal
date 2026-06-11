/**
 * Persona injection guards for the main-chat flows (WS3)
 *
 * Verifies that selecting a persona actually changes the MAIN journal chat's
 * system prompt: the freeform/continue flows must inject a `## Persona
 * Guidance` block containing the persona's prompt when `activePersona` is
 * present, and must omit it entirely otherwise. This is the byte-level proof
 * behind the user's "choosing person should work" requirement.
 */

import { THERAPIST_SYSTEM_PROMPT } from '../../constants/aiPrompts';
import { FLOWS } from '../../features/chat/flows';
import type { ChatFlowContext } from '../../features/chat/flows/types';
import type { Persona } from '../../services/personas/personasStorage.types';

const persona: Persona = {
    id: 'p-stoic',
    name: 'Marcus',
    tagline: 'A blunt stoic mentor',
    voice: 'Onyx',
    prompt: 'You are a blunt stoic mentor. Ask short, direct questions and value discipline.',
    model: 'agent-default',
    imagination: 20,
    createdAt: 0,
    updatedAt: 0,
};

describe('main chat persona injection (freeform)', () => {
    it('injects the persona block when an active persona is present', () => {
        const ctx: ChatFlowContext = {
            activePersona: persona,
            localMemoryContext: '## Local Memory Capsule\nYou prefer mornings.',
            feedbackGuidance: '## Response Feedback Memory\nBe concise.',
        };
        const out = FLOWS.freeform.buildSystemPrompt(ctx);
        expect(out).toContain('## Persona Guidance');
        expect(out).toContain(persona.prompt);
        // The base therapist prompt and other context still appear.
        expect(out).toContain(THERAPIST_SYSTEM_PROMPT);
        expect(out).toContain(ctx.localMemoryContext as string);
        expect(out).toContain(ctx.feedbackGuidance as string);
    });

    it('omits the persona block when no active persona is present', () => {
        const ctx: ChatFlowContext = {
            localMemoryContext: '## Local Memory Capsule\nYou prefer mornings.',
            feedbackGuidance: '## Response Feedback Memory\nBe concise.',
        };
        const out = FLOWS.freeform.buildSystemPrompt(ctx);
        expect(out).not.toContain('## Persona Guidance');
        expect(out).not.toContain(persona.prompt);
    });

    it('switching persona changes the produced system prompt', () => {
        const withPersona = FLOWS.freeform.buildSystemPrompt({ activePersona: persona });
        const withoutPersona = FLOWS.freeform.buildSystemPrompt({});
        expect(withPersona).not.toBe(withoutPersona);
    });
});

describe('main chat persona injection (continue)', () => {
    it('injects the persona block identically to freeform', () => {
        const ctx: ChatFlowContext = { activePersona: persona };
        expect(FLOWS.continue.buildSystemPrompt(ctx)).toBe(
            FLOWS.freeform.buildSystemPrompt(ctx)
        );
        expect(FLOWS.continue.buildSystemPrompt(ctx)).toContain('## Persona Guidance');
    });
});
