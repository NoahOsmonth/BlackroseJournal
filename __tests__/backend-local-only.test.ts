import fs from 'fs';
import path from 'path';

const REMOVED_RUNTIME_FILES = [
    'backend/railway.toml',
    'railway.toml',
    'backend/requirements-simplemem.txt',
    'backend/scripts/simplemem_bridge.py',
    'backend/src/agent/simpleMemService.ts',
    'backend/src/config/simpleMemConfig.ts',
];

const CLIENT_SOURCE_DIRS = [
    'app',
    'components',
    'constants',
    'features',
    'hooks',
    'services',
    'shared',
    'utils',
];

function sourceFiles(root: string): string[] {
    return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(root, entry.name);
        if (entry.isDirectory()) return sourceFiles(absolute);
        return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [absolute] : [];
    });
}

describe('Phase 0 backend boundary', () => {
    it('removes Railway and SimpleMem runtime artifacts', () => {
        for (const file of REMOVED_RUNTIME_FILES) {
            expect(fs.existsSync(path.join(process.cwd(), file))).toBe(false);
        }
    });

    it('keeps server-only credentials out of every client source file', () => {
        for (const directory of CLIENT_SOURCE_DIRS) {
            const root = path.join(process.cwd(), directory);
            for (const file of sourceFiles(root)) {
                const source = fs.readFileSync(file, 'utf-8');
                expect(source).not.toMatch(
                    /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|POSTGREST_SERVER_KEY/,
                );
            }
        }
    });

    it('keeps visible-response memory local during Phase 0', () => {
        const responsePathFiles = [
            'features/chat/flows/index.ts',
            'services/ai/ai.ts',
            'services/ai/historyPrefetch.ts',
        ];

        for (const file of responsePathFiles) {
            const source = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
            expect(source).not.toMatch(/memory\/cloud|cloudMemory|cloudReadAuthority/);
        }
    });
});

