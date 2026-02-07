import { redactSecrets } from '../backend/src/agent/redactSecrets';

describe('redactSecrets', () => {
    it('redacts OpenAI-style secret keys', () => {
        const input = 'here is a key sk-1234567890abcdefghijklmnopqrstuvwxyz and more text';
        expect(redactSecrets(input)).not.toContain('sk-1234567890abcdefghijklmnopqrstuvwxyz');
        expect(redactSecrets(input)).toContain('[REDACTED]');
    });

    it('redacts Nano/OpenRouter style keys', () => {
        const input = 'openrouter sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa nano sk-nano-aaaaaaaaaaaaaaaaaaaa';
        const output = redactSecrets(input);
        expect(output).not.toContain('sk-or-v1-aaaaaaaa');
        expect(output).not.toContain('sk-nano-aaaaaaaa');
        expect(output).toContain('[REDACTED]');
    });
});

