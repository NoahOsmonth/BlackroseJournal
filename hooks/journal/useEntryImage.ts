import { useCallback, useState } from 'react';
import { Share } from 'react-native';
import { downloadDataUrl, downloadTextFile } from '@/components/ui/webDownload';
import { EXPORT_PALETTES, buildEntryImage, entryImageFileName } from '@/utils/entryImage';
import { svgToPngDataUrl } from '@/utils/svgToPng';

export interface UseEntryImageReturn {
    readonly isExporting: boolean;
    /** Plain sentence to show the writer, or null while nothing has happened. */
    readonly message: string | null;
    readonly exportImage: (
        entryText: string,
        dateLabel: string,
        isDark: boolean,
        photo?: { dataUrl: string; width: number; height: number } | null,
    ) => Promise<void>;
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

    const exportImage = useCallback(async (
        entryText: string,
        dateLabel: string,
        isDark: boolean,
        photo?: { dataUrl: string; width: number; height: number } | null,
    ) => {
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
                photo: photo ?? undefined,
            });
            // PNG first: some chat apps will not preview an SVG at all, so the
            // shareable file is the raster one. The SVG stays as the fallback
            // because it is the only format this build can always produce.
            const png = await svgToPngDataUrl(svg, 1080);
            if (png && downloadDataUrl(entryImageFileName(dateLabel, 'png'), png)) {
                setMessage('Image saved to your downloads.');
                return;
            }
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
