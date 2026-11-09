/**
 * Rasterising a share image, where the platform cannot do it (Kaneo #54).
 *
 * The SVG card is the source of truth and works everywhere. Turning it into a
 * PNG needs something that can decode an image and read back pixels - a browser
 * canvas, or a native capture library on a phone. Only the browser exists in this
 * build, so this default returns null and the caller keeps shipping SVG.
 *
 * Returning null is the contract, not a failure: the caller must fall back, not
 * throw. Do not import a native capture library here without a branch that is
 * allowed to touch the lockfile.
 */
export async function svgToPngDataUrl(_svg: string, _width: number): Promise<string | null> {
    return null;
}
