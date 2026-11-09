/**
 * Export an entry as a shareable image (Kaneo #14).
 *
 * Builds a self-contained SVG. That choice is deliberate: no native capture
 * library, no font files to ship, identical output on phone and web, and the
 * bytes are testable. The writer gets a card with their words on it, not a
 * screenshot of the app.
 *
 * Pure — takes text and colours, returns markup. No I/O, no clock.
 */

export interface ExportPalette {
    /** Page colour behind the card. */
    readonly background: string;
    /** Card fill. */
    readonly surface: string;
    /** Entry text. */
    readonly text: string;
    /** Date and signature line. */
    readonly muted: string;
    /** Card border. */
    readonly hairline: string;
}

export const EXPORT_PALETTES: Record<'light' | 'dark', ExportPalette> = {
    light: {
        background: '#F6F2EC',
        surface: '#FFFDF9',
        text: '#1C1A17',
        muted: '#6B6560',
        hairline: '#E2DCD2',
    },
    dark: {
        background: '#121110',
        surface: '#1B1A18',
        text: '#F2EEE8',
        muted: '#8A8580',
        hairline: '#2C2A26',
    },
};

export interface ExportImageInput {
    readonly entryText: string;
    /** Already-formatted day, e.g. '8 Nov 2026'. */
    readonly dateLabel: string;
    readonly palette: ExportPalette;
    /** Card width in px. */
    readonly width?: number;
    /** The entry's photo, drawn above the words (Kaneo #107). */
    readonly photo?: { readonly dataUrl: string; readonly width: number; readonly height: number };
}

const WIDTH = 1080;
const PADDING = 96;
const FONT_SIZE = 34;
const LINE_HEIGHT = 52;
const MAX_LINE_CHARS = 34;

/** XML-escape, so a writer's apostrophe or ampersand cannot break the file. */
export function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Wrap text to a fixed character count.
 *
 * Character wrapping rather than measured wrapping: it cannot reflow between
 * renderers, so the exported image looks the same wherever it is opened. Long
 * words are left intact rather than chopped.
 */
export function wrapText(text: string, maxChars = MAX_LINE_CHARS): string[] {
    const lines: string[] = [];
    for (const paragraph of text.split(/\n/)) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            lines.push('');
            continue;
        }
        let current = '';
        for (const word of words) {
            if (current.length === 0) {
                current = word;
            } else if (current.length + 1 + word.length <= maxChars) {
                current += ` ${word}`;
            } else {
                lines.push(current);
                current = word;
            }
        }
        if (current.length > 0) lines.push(current);
    }
    return lines;
}

/** The title line and the trailing signature, both plain. */
const MAX_LINES = 40;

/** Tallest the photo may be drawn, so a portrait cannot crowd out the words. */
const PHOTO_MAX_HEIGHT = 640;

export function buildEntryImage({
    entryText,
    dateLabel,
    palette,
    width = WIDTH,
    photo,
}: ExportImageInput): string {
    const allLines = wrapText(entryText.trim());
    const lines = allLines.slice(0, MAX_LINES);
    const truncated = allLines.length > MAX_LINES;

    const headerHeight = 150;
    const footerHeight = 110;
    const bodyHeight = lines.length * LINE_HEIGHT;
    const textX = PADDING + 44;
    const textWidth = width - textX - PADDING;

    // The photo sits above the words, the way it would on a page. Its height is
    // capped so a tall portrait cannot push the text off the card.
    const photoHeight = photo && photo.width > 0 && photo.height > 0
        ? Math.min(Math.round(textWidth * (photo.height / photo.width)), PHOTO_MAX_HEIGHT)
        : 0;
    const photoGap = photoHeight > 0 ? 40 : 0;
    const height = PADDING * 2 + headerHeight + photoHeight + photoGap + bodyHeight + footerHeight;
    const bodyTop = PADDING + headerHeight + photoHeight + photoGap;
    const rows = lines
        .map((line, index) => {
            const y = bodyTop + index * LINE_HEIGHT + FONT_SIZE;
            return `    <text x="${textX}" y="${y}" font-family="Georgia, serif" font-size="${FONT_SIZE}" fill="${palette.text}">${escapeXml(line)}</text>`;
        })
        .join('\n');

    // Rounded corners on the photo, clipped rather than masked: every SVG
    // renderer that matters supports clipPath, and the PNG pass goes through one.
    const photoBlock = photoHeight > 0 && photo
        ? [
            `  <clipPath id="entry-photo-clip"><rect x="${textX}" y="${PADDING + headerHeight}" width="${textWidth}" height="${photoHeight}" rx="18"/></clipPath>`,
            `  <image href="${photo.dataUrl}" x="${textX}" y="${PADDING + headerHeight}" width="${textWidth}" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#entry-photo-clip)"/>`,
        ].join('\n')
        : '';

    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `  <rect width="${width}" height="${height}" fill="${palette.background}"/>`,
        `  <rect x="${PADDING / 2}" y="${PADDING / 2}" width="${width - PADDING}" height="${height - PADDING}" rx="24" fill="${palette.surface}" stroke="${palette.hairline}" stroke-width="2"/>`,
        `  <text x="${textX}" y="${PADDING + 54}" font-family="Georgia, serif" font-size="26" letter-spacing="4" fill="${palette.muted}">${escapeXml(dateLabel.toUpperCase())}</text>`,
        `  <line x1="${textX}" y1="${PADDING + 84}" x2="${textX + 96}" y2="${PADDING + 84}" stroke="${palette.hairline}" stroke-width="2"/>`,
        photoBlock,
        rows,
        truncated ? `  <text x="${textX}" y="${PADDING + headerHeight + lines.length * LINE_HEIGHT + 44}" font-family="Georgia, serif" font-size="26" fill="${palette.muted}">…</text>` : '',
        `  <text x="${textX}" y="${height - PADDING - 8}" font-family="Georgia, serif" font-size="26" fill="${palette.muted}">Blackrose</text>`,
        '</svg>',
        '',
    ].filter((line) => line !== '').join('\n');
}

export type EntryImageFormat = 'png' | 'svg';

export function entryImageFileName(dateLabel: string, format: EntryImageFormat = 'svg'): string {
    const safe = dateLabel.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `blackrose-${safe || 'entry'}.${format}`;
}
