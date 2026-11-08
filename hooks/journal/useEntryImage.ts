import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import { downloadTextFile } from '@/components/ui/webDownload';
import { EXPORT_PALETTES, buildEntryImage, entryImageFileName } from '@/utils/entryImage';

export interface UseEntryImageReturn {
    readonly isExporting: boolean;
    /** Plain sentence to show the writer, or null while nothing has happened. */
    readonly message: string | null;
    readonly exportImage: (entryText: string, dateLabel: string, isDark: boolean) => Promise<void>;
}

/**
 * Share one entry as an image (Kaneo #14).
 *
 * The image is built locally as SVG, so this never reaches the network. On web
 * it becomes a real download; on a phone it goes to the share sheet.
 */
export function useEntryImage(): UseEntryImageReturn {
    const [isExporting, setIsExporting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const exportImage = useCallback(async (entryText: string, dateLabel: string, isDark: boolean) => {
        if (entryText.trim().length === 0) {
            setMessage('There is nothing in this entry to share yet.');
            return;
        }
        setIsExporting(true);
        setMessage(null);
        try {
            const svg = buildEntryImage({
                entryText,
                dateLabel,
                palette: isDark ? EXPORT_PALETTES.dark : EXPORT_PALETTES.light,
            });
            const fileName = entryImageFileName(dateLabel);
            if (downloadTextFile(fileName, svg, 'image/svg+xml')) {
                setMessage('Image saved to your downloads.');
                return;
            }
            await Share.share({ message: svg, title: fileName });
            setMessage('Image ready to share.');
        } catch {
            setMessage('The image could not be made. Try again in a moment.');
        } finally {
            setIsExporting(false);
        }
    }, []);

    return { isExporting, message, exportImage };
}
