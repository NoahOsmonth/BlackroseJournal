import fs from 'fs';
import path from 'path';

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

    it('uses the aurora constellation layer palette', () => {
        const enginePath = path.join(
            process.cwd(),
            'assets',
            'memory-graph',
            'engine.html'
        );
        const engine = fs.readFileSync(enginePath, 'utf-8');
        expect(engine).toContain("episodic: '#C4A1FF'");
        expect(engine).toContain("semantic: '#7DD3FC'");
        expect(engine).toContain("profile: '#FDA4AF'");
        expect(engine).toContain("procedural: '#6EE7B7'");
        expect(engine).toContain("note: '#FCD34D'");
        expect(engine).toContain("working: '#F0ABFC'");
    });
});
