import fs from 'fs';
import path from 'path';

function sourceFor(relativePath: string): string {
    return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

describe('tab bottom spacing', () => {
    it('keeps scrollable tab content above the absolute bottom nav via nav-aware padding', () => {
        const tabFiles = [
            'app/(tabs)/today.tsx',
            'app/(tabs)/entries.tsx',
            'app/(tabs)/insights.tsx',
            'app/(tabs)/settings.tsx',
        ];

        for (const file of tabFiles) {
            const src = sourceFor(file);
            // No more hardcoded 140 guesses — clearance derives from the real safe-area inset.
            expect(src).toContain('navAwareBottomPadding(insets.bottom)');
            expect(src).not.toContain('paddingBottom: 140');
        }
    });

    it('keeps the Memory graph stage above the absolute bottom nav', () => {
        expect(sourceFor('components/memory-graph/MemoryGraphScreen.tsx'))
            .toContain('className="mb-32 flex-1');
    });
});
