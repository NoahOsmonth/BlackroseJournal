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

describe('local-only backend cleanup', () => {
    it('removes Railway and SimpleMem runtime artifacts', () => {
        for (const file of REMOVED_RUNTIME_FILES) {
            expect(fs.existsSync(path.join(process.cwd(), file))).toBe(false);
        }
    });

    it('keeps backend chat services free of long-term memory imports', () => {
        const files = [
            'backend/src/agent/agentService.ts',
            'backend/src/agent/askRosebudService.ts',
            'backend/src/agent/systemPrompt.ts',
        ];

        for (const file of files) {
            const source = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
            expect(source).not.toMatch(/simpleMem|Long-Term Memory|Memory Guidance/);
            expect(source).not.toMatch(/storeMessageInLongTermMemory|retrieveLongTermMemoryContext/);
        }
    });
});

