import { useEffect, useState } from 'react';
import type { MemoryGraphAtom, MemorySourcePreview } from '@/services/memory/memoryGraph.types';
import { resolveMemorySource } from '@/services/memory/memorySourceResolver';

interface UseMemorySourcePreviewResult {
    preview: MemorySourcePreview | null;
    isLoading: boolean;
    /** True when a navigable root exists but storage returned nothing. */
    missing: boolean;
}

/**
 * Loads conversation preview for the selected graph atom.
 * Cancels in-flight work when the selection changes.
 */
export function useMemorySourcePreview(
    atom: MemoryGraphAtom | null
): UseMemorySourcePreviewResult {
    const [preview, setPreview] = useState<MemorySourcePreview | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (!atom) {
            setPreview(null);
            setIsLoading(false);
            setMissing(false);
            return () => {
                cancelled = true;
            };
        }

        const hasRoot = Boolean(atom.rootSourceId)
            || (atom.source === 'journal' || atom.source === 'intention');

        if (!hasRoot && atom.source !== 'journal' && atom.source !== 'intention') {
            setPreview(null);
            setIsLoading(false);
            setMissing(false);
            return () => {
                cancelled = true;
            };
        }

        setIsLoading(true);
        setMissing(false);
        setPreview(null);

        resolveMemorySource(atom)
            .then((resolved) => {
                if (cancelled) return;
                setPreview(resolved);
                setMissing(resolved === null && (atom.source === 'journal' || atom.source === 'intention'));
                setIsLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setPreview(null);
                setMissing(true);
                setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [atom]);

    return { preview, isLoading, missing };
}
