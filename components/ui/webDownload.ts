/**
 * Web-safe file delivery.
 *
 * `Share.share` is a no-op under react-native-web, so export actions silent-fail
 * on web unless we hand the payload to the browser as a real download
 * (see docs/qa/DEFECTS.md DEF-010).
 *
 * Returns `true` when a download was triggered, `false` when the environment has
 * no DOM/blob support — callers then keep their native path (Share sheet).
 */
export function downloadTextFile(fileName: string, contents: string, mimeType = 'application/json'): boolean {
    if (typeof document === 'undefined' || typeof Blob === 'undefined') {
        return false;
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return false;
    }

    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return true;
}
