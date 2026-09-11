import fs from 'fs';
import path from 'path';

/**
 * Memory-graph presentation law (plan §5). The node sheet, its provenance card
 * and the layer filters follow black-rose-graph-node-sheet.png: a bone rule down
 * the sheet, serif title + section headings, outline chips on hairlines, muted
 * family dots, and an outline "Deepen with AI" action.
 *
 * Source-level guards so a later edit cannot quietly restore the pre-rewrite
 * sheet (filled layer-colored rail, emoji provenance, rainbow layer dots).
 */

const read = (...segments: string[]) =>
    fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');

const GRAPH_DIR = ['components', 'memory-graph'] as const;

const FILE_NAMES = [
    'MemoryGraphSheet.tsx',
    'MemoryGraphSourceCard.tsx',
    'MemoryGraphFilters.tsx',
    'MemoryGraphHeader.tsx',
    'MemoryGraphRangeRail.tsx',
    'MemoryGraphScreen.tsx',
];

const RAINBOW_HEXES = [
    '#C4A1FF',
    '#7DD3FC',
    '#FDA4AF',
    '#6EE7B7',
    '#FCD34D',
    '#F0ABFC',
];

describe('memory graph presentation', () => {
    it('gives the node sheet a bone rule, serif title and sheet radius', () => {
        const sheet = read(...GRAPH_DIR, 'MemoryGraphSheet.tsx');

        expect(sheet).toContain('ml-5 w-px self-stretch bg-bone-light dark:bg-bone-dark');
        expect(sheet).toContain('rounded-sheet');
        expect(sheet).toContain("const SERIF = 'PlayfairDisplayRegular'");
        expect(sheet).toContain('Linked stars');
        expect(sheet).toContain('At a glance');
        expect(sheet).toContain('Deepen with AI');
    });

    it('keeps chips, rows and the primary action as outlines on hairlines', () => {
        const sheet = read(...GRAPH_DIR, 'MemoryGraphSheet.tsx');

        expect(sheet).toContain(
            'rounded-control border px-2.5 py-1 text-[13px] text-text-light'
        );
        expect(sheet).toContain('rounded-card border');
        // No layer-colored fills left anywhere in the sheet.
        expect(sheet).not.toContain('MemoryLayerColors');
        expect(sheet).not.toMatch(/style=\{\{\s*backgroundColor:\s*layerColor/);
        expect(sheet).not.toContain('bg-background-light');
    });

    it('renders provenance without an emoji glyph', () => {
        const sourceCard = read(...GRAPH_DIR, 'MemoryGraphSourceCard.tsx');

        expect(sourceCard).toContain('Open conversation');
        expect(sourceCard).toContain('border-hairline-light dark:border-hairline-dark');
        expect(sourceCard).not.toContain('preview.emoji');
        expect(sourceCard).not.toContain('text-primary');
    });

    it('paints layer dots from the three-family shades, never a rainbow hex', () => {
        const sheet = read(...GRAPH_DIR, 'MemoryGraphSheet.tsx');
        const filters = read(...GRAPH_DIR, 'MemoryGraphFilters.tsx');

        // Related-memory dots stay on the family shades; the filter chips are
        // undotted in the concept, so they carry no colour at all.
        expect(sheet).toContain('memoryLayerShades');
        expect(filters).not.toContain('memoryLayerShades');
        expect(filters).toContain('border-bone-light');
        expect(filters).toContain('dark:border-bone-dark');

        FILE_NAMES.forEach((name) => {
            const content = read(...GRAPH_DIR, name).toUpperCase();
            RAINBOW_HEXES.forEach((hex) => {
                expect(`${name}: ${content}`).not.toContain(hex);
            });
            expect(`${name}: ${content}`).not.toContain('#070B14');
        });
    });
});
