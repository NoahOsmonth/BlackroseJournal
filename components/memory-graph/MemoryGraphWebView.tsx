import { Asset } from 'expo-asset';
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

export function MemoryGraphWebView({
    atoms,
    connections,
    onSelectNode,
}: WebViewProps) {
    const webViewRef = useRef<WebView>(null);
    const [engineUri, setEngineUri] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const syncData = useCallback(() => {
        const payload = JSON.stringify({ type: 'SYNC_DATA', atoms, connections });
        webViewRef.current?.postMessage(payload);
    }, [atoms, connections]);

    useEffect(() => {
        Asset.fromModule(memoryGraphEngine)
            .downloadAsync()
            .then((asset) => {
                setIsLoaded(false);
                setEngineUri(asset.localUri ?? asset.uri);
            })
            .catch(() => setEngineUri(null));
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
            source={engineUri ? { uri: engineUri } : { html: FALLBACK_HTML }}
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
