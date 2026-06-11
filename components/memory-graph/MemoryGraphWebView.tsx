import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import memoryGraphEngine from '@/assets/memory-graph/engine.html';
import type {
    LocalMemoryAtom,
    MemoryConnection,
} from '@/services/memory/memoryGraph.types';
import type { WebViewMessageEvent } from 'react-native-webview';

interface WebViewProps {
    atoms: LocalMemoryAtom[];
    connections: MemoryConnection[];
    onSelectNode: (id: string | null) => void;
}

const FALLBACK_HTML = '<html><body style="background:#000"></body></html>';
const MEMORY_GRAPH_BASE_URL = 'https://memory-graph.local';

export function MemoryGraphWebView({
    atoms,
    connections,
    onSelectNode,
}: WebViewProps) {
    const webViewRef = useRef<WebView>(null);
    const [engineHtml, setEngineHtml] = useState(FALLBACK_HTML);
    const [isLoaded, setIsLoaded] = useState(false);

    const syncData = useCallback(() => {
        const payload = JSON.stringify({ type: 'SYNC_DATA', atoms, connections });
        webViewRef.current?.postMessage(payload);
    }, [atoms, connections]);

    useEffect(() => {
        let isMounted = true;

        Asset.fromModule(memoryGraphEngine)
            .downloadAsync()
            .then((asset) => FileSystem.readAsStringAsync(asset.localUri ?? asset.uri))
            .then((html) => {
                if (!isMounted) return;
                setIsLoaded(false);
                setEngineHtml(html);
            })
            .catch(() => {
                if (isMounted) setEngineHtml(FALLBACK_HTML);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (isLoaded) syncData();
    }, [isLoaded, syncData]);

    const handleMessage = (event: WebViewMessageEvent) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'NODE_SELECTED') onSelectNode(data.id ?? null);
        } catch {
            onSelectNode(null);
        }
    };

    return (
        <WebView
            ref={webViewRef}
            style={styles.webView}
            originWhitelist={['*']}
            source={{ html: engineHtml, baseUrl: MEMORY_GRAPH_BASE_URL }}
            onLoadEnd={() => setIsLoaded(true)}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
        />
    );
}

const styles = StyleSheet.create({
    webView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
});
