import fs from 'fs';
import path from 'path';

describe('AGENTS memory graph guidance', () => {
    const agentsPath = path.join(process.cwd(), 'AGENTS.md');
    const source = fs.readFileSync(agentsPath, 'utf-8');

    it('removes stale SimpleMem and Railway guidance from AGENTS.md', () => {
        expect(source).not.toMatch(/SimpleMem|SIMPLEMEM_ENABLED/);
        expect(source).not.toMatch(/OPENROUTER_EMBEDDING_API_KEY/);
        expect(source).not.toMatch(/Railway|railway\.toml/);
    });

    it('documents graph-specific architecture and test commands', () => {
        expect(source).toContain('Prototype Files Validation Strategy');
        expect(source).toContain('EXPO_PUBLIC_DATA_PROVIDER');
        expect(source).toContain('react-native-webview');
        expect(source).toContain('npm run check:design');
        expect(source).toContain('cd backend && npm test');
        expect(source).toContain('cd backend && npx tsc --noEmit');
    });
});
