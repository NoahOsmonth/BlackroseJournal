/**
 * Stepping one day at a time through the year grid (Kaneo #111).
 *
 * The year heatmap draws 371 cells at 14px. That is a good picture and a bad
 * button - a fingertip is wider than three cells - so the squares are a picture
 * now and the day is chosen with 44px controls that step one day at a time.
 */

/** Local calendar keys are YYYY-MM-DD; shifting is calendar arithmetic, not a
 * duration, so month and year ends are handled by Date itself. */
export function shiftDayKey(dateKey: string, delta: number): string {
    const parts = dateKey.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dateKey;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + delta);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
}

/** Keeps a stepped day inside the range the grid actually draws. */
export function clampDayKey(dateKey: string, firstKey: string, lastKey: string): string {
    if (dateKey < firstKey) return firstKey;
    if (dateKey > lastKey) return lastKey;
    return dateKey;
}