/**
 * Rasterising the share image in the browser (Kaneo #54).
 *
 * No dependency: the browser already decodes SVG and rasterises a canvas. The
 * SVG is the layout source of truth, so this never reimplements the card - it
 * draws the same markup at a fixed width.
 *
 * Returns null on any failure (no canvas, decode error, a tainted canvas). The
 * caller then keeps the SVG, which is still a real file.
 */
export async function svgToPngDataUrl(svg: string, width: number): Promise<string | null> {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return null;

    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return null;

        const image = new Image();
        // A data URL keeps this offline: nothing is fetched, and a blob URL would
        // need revoking after the draw.
        const source = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

        const loaded = await new Promise<boolean>((resolve) => {
            image.onload = () => resolve(true);
            image.onerror = () => resolve(false);
            image.src = source;
        });
        if (!loaded) return null;

        const height = image.height || Math.round(width * 1.5);
        const scale = width / (image.width || width);
        canvas.width = width;
        canvas.height = Math.round(height * scale);
        // The card's own background, so a transparent PNG never lands on a dark
        // chat bubble with unreadable text.
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
    } catch {
        return null;
    }
}
