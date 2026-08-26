import fs from 'node:fs';
import path from 'node:path';

describe('local Supabase control-plane exposure', () => {
    it('exposes the private control schema to server-authenticated PostgREST requests', () => {
        const config = fs.readFileSync(
            path.join(process.cwd(), 'supabase', 'config.toml'),
            'utf8'
        );
        const apiSection = config.match(/\[api\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';
        const schemas = apiSection.match(/^schemas\s*=\s*\[([^\]]+)\]/m)?.[1] ?? '';

        expect(schemas.split(',').map((value) => value.trim().replace(/^"|"$/g, '')))
            .toContain('control');
    });
});
