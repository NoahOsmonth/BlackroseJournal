import fs from 'fs';
import path from 'path';

import { BLACKROSE_GRAPH_FAMILIES, BLACKROSE_PALETTE } from '../constants/blackrose';

describe('memory graph asset integration', () => {
    it('keeps the production engine in assets and decoupled from prototypes', () => {
        const enginePath = path.join(
            process.cwd(),
            'assets',
            'memory-graph',
            'engine.html'
        );
        const webViewPath = path.join(
            process.cwd(),
            'components',
            'memory-graph',
            'MemoryGraphWebView.tsx'
        );
        const webBridgePath = path.join(
            process.cwd(),
            'components',
            'memory-graph',
            'MemoryGraphWebView.web.tsx'
        );

        const engine = fs.readFileSync(enginePath, 'utf-8');
        const webView = fs.readFileSync(webViewPath, 'utf-8');
        const webBridge = fs.readFileSync(webBridgePath, 'utf-8');

        expect(engine).toContain('ReactNativeWebView');
        expect(engine).toContain('window.parent.postMessage');
        expect(engine).toContain('SYNC_DATA');
        expect(engine).toContain('SET_THEME');
        expect(engine).toContain('NODE_SELECTED');
        expect(webView).toContain('@/assets/memory-graph/engine.html');
        expect(webBridge).toContain('iframe');
        expect(webBridge).toContain('@/assets/memory-graph/engine.html');
        expect(webView).toContain("expo-file-system/legacy");
        expect(webView).toContain('FileSystem.readAsStringAsync');
        expect(webView).toContain('source={{ html: engineHtml');
        expect(webView).toContain('SET_THEME');
        expect(webBridge).toContain('SET_THEME');
        expect(webView).not.toContain('example-design');
        expect(webView).not.toContain('source={engineUri ? { uri: engineUri }');
        expect(webBridge).not.toContain('example-design');
    });

    it('ships the constellation night-sky paint surface in the production engine', () => {
        const enginePath = path.join(
            process.cwd(),
            'assets',
            'memory-graph',
            'engine.html'
        );
        const engine = fs.readFileSync(enginePath, 'utf-8');

        // Design direction + paint contract
        expect(engine).toContain('Constellation Night Sky');
        expect(engine).toContain('drawStarNode');
        expect(engine).toContain('drawNodeMark');
        expect(engine).toContain('drawSelectionRings');
        expect(engine).toContain('rebuildVisualClusters');
        expect(engine).toContain('roundedPill');
        expect(engine).toContain('selectedAt');
        expect(engine).toContain('BLOOM_MS');
        expect(engine).toContain('CLUSTER_ZOOM');
        expect(engine).toContain('LABEL_ZOOM');
        expect(engine).toContain('MIN_HIT_SCREEN');
        expect(engine).toContain('function applyTheme');
        expect(engine).toContain("light:");
        expect(engine).toContain("dark:");
        expect(engine).toContain('showStars');
        expect(engine).toContain('nebulaSeeds');
        expect(engine).toContain('recencyScore');
        expect(engine).toContain('focusOnCluster');

        // Anti-slop: no prototype path, no forever selection ripple timer
        expect(engine).not.toContain('example-design');
        expect(engine).not.toContain('1700');
    });

    it('sets node labels as bare serif lines, not pill badges', () => {
        const enginePath = path.join(
            process.cwd(),
            'assets',
            'memory-graph',
            'engine.html'
        );
        const engine = fs.readFileSync(enginePath, 'utf-8');

        // The concept labels stars with plain serif text wrapped to two short lines.
        expect(engine).toContain('function wrapLabel');
        expect(engine).toContain('LABEL_WRAP_CHARS');
        expect(engine).toContain('LABEL_LINE_H');
        expect(engine).toContain('Georgia');
        expect(engine).toContain('serif');
        // The pre-rewrite pill + accent tick behind every node label is gone.
        expect(engine).not.toContain('labelPill');
        expect(engine).not.toContain('node.r * camera.scale + 16');
    });

    it('paints the Blackrose three-family layer palette, not a rainbow', () => {
        const enginePath = path.join(
            process.cwd(),
            'assets',
            'memory-graph',
            'engine.html'
        );
        const engine = fs.readFileSync(enginePath, 'utf-8');

        // Bone, sage and muted rose only — two shades per family.
        [
            BLACKROSE_GRAPH_FAMILIES.dark.bone,
            BLACKROSE_GRAPH_FAMILIES.dark.sage,
            BLACKROSE_GRAPH_FAMILIES.dark.rose,
        ].forEach((shades) => {
            expect(engine.toUpperCase()).toContain(shades.base.toUpperCase());
            expect(engine.toUpperCase()).toContain(shades.deep.toUpperCase());
        });

        // The pre-rewrite aurora set must be gone.
        ['#C4A1FF', '#7DD3FC', '#FDA4AF', '#6EE7B7', '#FCD34D', '#F0ABFC'].forEach((hex) => {
            expect(engine.toUpperCase()).not.toContain(hex);
        });
    });

    it('paints the Blackrose void and paper in both engine themes', () => {
        const enginePath = path.join(
            process.cwd(),
            'assets',
            'memory-graph',
            'engine.html'
        );
        const engine = fs.readFileSync(enginePath, 'utf-8');
        const upper = engine.toUpperCase();

        expect(upper).toContain(BLACKROSE_PALETTE.dark.bg.toUpperCase());
        expect(upper).toContain(BLACKROSE_PALETTE.light.bg.toUpperCase());
        expect(upper).toContain(BLACKROSE_PALETTE.dark.surface.toUpperCase());
        // The old night-sky page backgrounds must be gone.
        expect(upper).not.toContain('#06080F');
        expect(upper).not.toContain('#EEF1F8');
    });
});
