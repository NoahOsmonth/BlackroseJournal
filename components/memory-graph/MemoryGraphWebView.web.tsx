import { Asset } from 'expo-asset';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import memoryGraphEngine from '@/assets/memory-graph/engine.html';
import type {
    MemoryGraphAtom,
    MemoryConnection,
} from '@/services/memory/memoryGraph.types';

interface WebViewProps {
    atoms: MemoryGraphAtom[];
    connections: MemoryConnection[];
    colorScheme?: 'light' | 'dark';
    onSelectNode: (id: string | null) => void;
}

export function MemoryGraphWebView({
    atoms,
    connections,
    colorScheme = 'dark',
    onSelectNode,
}: WebViewProps) {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const [engineUri, setEngineUri] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const postToEngine = useCallback((payload: object) => {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
    }, []);

    const syncData = useCallback(() => {
        postToEngine({ type: 'SYNC_DATA', atoms, connections });
    }, [atoms, connections, postToEngine]);

    const syncTheme = useCallback(() => {
        postToEngine({ type: 'SET_THEME', theme: colorScheme });
    }, [colorScheme, postToEngine]);

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
        const handleMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(String(event.data));
                if (data.type === 'NODE_SELECTED') onSelectNode(data.id ?? null);
            } catch {
                onSelectNode(null);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onSelectNode]);

    useEffect(() => {
        if (!isLoaded) return;
        syncTheme();
        syncData();
    }, [isLoaded, syncData, syncTheme]);

    return (
        <View style={styles.container}>
            {React.createElement('iframe', {
                ref: iframeRef,
                src: engineUri ?? 'about:blank',
                onLoad: () => setIsLoaded(true),
                title: 'Memory graph canvas',
                style: styles.iframe,
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    iframe: {
        width: '100%',
        height: '100%',
        borderWidth: 0,
        backgroundColor: 'transparent',
    },
});
