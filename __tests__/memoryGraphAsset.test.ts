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
        expect(engine).toContain('NODE_SELECTED');
        expect(webView).toContain('@/assets/memory-graph/engine.html');
        expect(webBridge).toContain('iframe');
        expect(webBridge).toContain('@/assets/memory-graph/engine.html');
        expect(webView).toContain("expo-file-system/legacy");
        expect(webView).toContain('FileSystem.readAsStringAsync');
        expect(webView).toContain('source={{ html: engineHtml');
        expect(webView).not.toContain('example-design');
        expect(webView).not.toContain('source={engineUri ? { uri: engineUri }');
        expect(webBridge).not.toContain('example-design');
    });
});
