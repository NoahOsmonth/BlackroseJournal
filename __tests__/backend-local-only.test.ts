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

// The abandoned custom cloud-memory implementation (LOCAL -> MIRROR -> SHADOW ->
// CLOUD control plane: mirror outbox, dataset binding, source inventory, memory
// authority). Zero references may remain in production sources.
const FORBIDDEN_CLOUD_MEMORY =
    /memory\/cloud|cloudMemory|cloudReadAuthority|mirrorOutbox|datasetBinding|sourceInventory|memoryAuthority/i;

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

const REMOVAL_SCAN_ROOTS = [
    'app',
    'components',
    'hooks',
    'services',
    'backend/src',
    'utils',
    'constants',
    'shared',
];

function sourceFiles(root: string): string[] {
    if (!fs.existsSync(root)) {
        return [];
    }
    return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const absolute = path.join(root, entry.name);
        if (entry.isDirectory()) return sourceFiles(absolute);
        return /\.(?:ts|tsx|js|jsx)$/.test(entry.name) ? [absolute] : [];
    });
}

describe('abandoned cloud-memory removal boundary', () => {
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

    it('keeps zero references to the abandoned cloud-memory implementation in production sources', () => {
        const offenders: string[] = [];
        for (const directory of REMOVAL_SCAN_ROOTS) {
            const root = path.join(process.cwd(), directory);
            for (const file of sourceFiles(root)) {
                const source = fs.readFileSync(file, 'utf-8');
                if (FORBIDDEN_CLOUD_MEMORY.test(source)) {
                    offenders.push(file);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
