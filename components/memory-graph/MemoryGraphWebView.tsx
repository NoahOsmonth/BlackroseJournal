import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import memoryGraphEngine from '@/assets/memory-graph/engine.html';
import type {
    MemoryGraphAtom,
    MemoryConnection,
} from '@/services/memory/memoryGraph.types';
import type { WebViewMessageEvent } from 'react-native-webview';

interface WebViewProps {
    atoms: MemoryGraphAtom[];
    connections: MemoryConnection[];
    colorScheme?: 'light' | 'dark';
    onSelectNode: (id: string | null) => void;
}

const FALLBACK_HTML = '<html><body style="background:#F3F4F6"></body></html>';
const MEMORY_GRAPH_BASE_URL = 'https://memory-graph.local';

export function MemoryGraphWebView({
    atoms,
    connections,
    colorScheme = 'dark',
    onSelectNode,
}: WebViewProps) {
    const webViewRef = useRef<WebView>(null);
    const [engineHtml, setEngineHtml] = useState(FALLBACK_HTML);
    const [isLoaded, setIsLoaded] = useState(false);

    const postToEngine = useCallback((payload: object) => {
        webViewRef.current?.postMessage(JSON.stringify(payload));
    }, []);

    const syncData = useCallback(() => {
        postToEngine({ type: 'SYNC_DATA', atoms, connections });
    }, [atoms, connections, postToEngine]);

    const syncTheme = useCallback(() => {
        postToEngine({ type: 'SET_THEME', theme: colorScheme });
    }, [colorScheme, postToEngine]);

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
        if (!isLoaded) return;
        syncTheme();
        syncData();
    }, [isLoaded, syncData, syncTheme]);

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
