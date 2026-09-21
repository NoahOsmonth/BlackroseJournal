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
        const src = sourceFor('components/memory-graph/MemoryGraphScreen.tsx');

        expect(src).toContain('navAwareBottomPadding(insets.bottom)');
        // The old clearance lived on the graph stage as `mb-32`, which spent the
        // dock's height *above* the stats strip and left the strip pinned under
        // the bar.
        expect(src).not.toContain('mb-32');
    });

    it('floats the Threads stats strip on the graph instead of in a footer band', () => {
        const src = sourceFor('components/memory-graph/MemoryGraphScreen.tsx');

        // Painted *inside* the stage: the canvas dims toward its edges, so any
        // surface below it shows up as a grey slab (the reported bug).
        expect(src).toContain('memory-graph-stats-overlay');
        expect(src.indexOf('memory-graph-stage')).toBeLessThan(
            src.indexOf('memory-graph-stats-overlay')
        );
        // The overlay is transparent and lets taps reach the graph.
        expect(src).toContain('pointerEvents="none"');
    });

    it('never gives the stats strip a surface or a bottom margin of its own', () => {
        const strip = sourceFor('components/memory-graph/MemoryGraphStats.tsx');
        expect(strip).not.toContain('mb-3');
        // No fill: the strip is hairline cells. A background here is the grey
        // slab the graph screen must not have.
        expect(strip).not.toMatch(/bg-(surface|background)/);
    });

    it('draws the stats strip as a HUD rule, not a framed card', () => {
        const strip = sourceFor('components/memory-graph/MemoryGraphStats.tsx');

        // The rounded outline framed the flat band behind the strip and read as
        // a grey panel floating on the graph (the reported bug).
        expect(strip).not.toContain('rounded-card');
        expect(strip).not.toMatch(/className={`mx-5 flex-row [^`]*border `/);
        // A single top rule plus the cell dividers keep the concept's hairlines.
        expect(strip).toContain('border-t');
        expect(strip).toContain('border-l');
    });

    it('dissolves the graph into the void under the chrome instead of showing a slab', () => {
        const engine = sourceFor('assets/memory-graph/engine.html');

        // The canvas dims to its vignette tone while the RN chrome sits on the
        // app void, so the bottom band needed an explicit fade to the void tone.
        expect(engine).toContain('CHROME_FADE_H');
        expect(engine).toContain('bottomFade');
        expect(engine).toContain('pageBgRgb');
        expect(engine).toContain("ctx.fillRect(0, height - CHROME_FADE_H, width, CHROME_FADE_H)");
    });
});
