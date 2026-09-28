/**
 * Image attachments for chat turns (vision).
 *
 * Two concerns, kept apart on purpose:
 *  - **Storage shape**: a message persists only `uri` + `mimeType` + dimensions.
 *    Base64 never lands in AsyncStorage (one 2 MP photo is ~2 MB, past Android's
 *    per-key ceiling — AGENTS storage rule).
 *  - **Wire shape**: the provider needs a `data:` URL. That is derived on demand
 *    and cached in memory for the session, so a multi-turn conversation does not
 *    re-encode the same photo every turn.
 *
 * Resolution order for the bytes: in-memory cache → the picker's own base64 →
 * the file on disk (native) → the blob URL (web). Anything unavailable degrades
 * to text-only for that turn instead of failing the send.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface ChatImageAttachment {
    /** Local file / blob URI — the only field that is ever persisted. */
    uri: string;
    mimeType?: string;
    width?: number;
    height?: number;
}

/** Picker output: the attachment plus the base64 the picker already produced. */
export interface PickedChatImage extends ChatImageAttachment {
    base64?: string;
}

const DEFAULT_MIME_TYPE = 'image/jpeg';
const MAX_DATA_URL_BYTES = 12 * 1024 * 1024;

/** uri → data URL. Session-scoped; never written anywhere. */
const dataUrlCache = new Map<string, string>();

function normalizeMimeType(mimeType?: string): string {
    if (!mimeType) return DEFAULT_MIME_TYPE;
    const trimmed = mimeType.trim().toLowerCase();
    return trimmed.startsWith('image/') ? trimmed : DEFAULT_MIME_TYPE;
}

function toDataUrl(base64: string, mimeType?: string): string {
    return `data:${normalizeMimeType(mimeType)};base64,${base64}`;
}

function readBase64FromUri(uri: string): Promise<string | null> {
    if (Platform.OS === 'web') {
        return fetch(uri)
            .then((response) => response.blob())
            .then((blob) => new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('Could not read the selected image.'));
                reader.onload = () => {
                    const result = typeof reader.result === 'string' ? reader.result : '';
                    const comma = result.indexOf(',');
                    resolve(comma >= 0 ? result.slice(comma + 1) : result);
                };
                reader.readAsDataURL(blob);
            }))
            .catch(() => null);
    }
    return FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
    }).catch(() => null);
}

/** Drop a cached encoding (e.g. the user removed the attachment before sending). */
export function forgetImageDataUrl(uri: string): void {
    dataUrlCache.delete(uri);
}

/**
 * Cache the picker's own base64 so the first send does not re-read the file.
 * Only the uri/mimeType/dimensions ever travel on a message — the bytes stay
 * here, in memory, for the life of the session.
 */
export function primeImageDataUrl(attachment: PickedChatImage): void {
    if (!attachment?.uri || !attachment.base64) return;
    if (attachment.base64.length > MAX_DATA_URL_BYTES) return;
    dataUrlCache.set(attachment.uri, toDataUrl(attachment.base64, attachment.mimeType));
}

export function clearImageDataUrlCache(): void {
    dataUrlCache.clear();
}

/**
 * The `data:` URL for an attachment, or null when the bytes are gone (cache
 * eviction, deleted file, permission). Callers must treat null as "send text
 * only", never as a reason to drop the turn.
 */
export async function resolveImageDataUrl(
    attachment: ChatImageAttachment & { base64?: string }
): Promise<string | null> {
    if (!attachment?.uri) return null;

    const cached = dataUrlCache.get(attachment.uri);
    if (cached) return cached;

    const base64 = attachment.base64 ?? (await readBase64FromUri(attachment.uri));
    if (!base64) return null;
    if (base64.length > MAX_DATA_URL_BYTES) return null;

    const dataUrl = toDataUrl(base64, attachment.mimeType);
    dataUrlCache.set(attachment.uri, dataUrl);
    return dataUrl;
}

/**
 * Build the messageId → data URL map a request needs. Messages without an
 * image, or whose bytes are unavailable, are simply absent from the map.
 */
export async function resolveImageDataUrls(
    attachments: { id: string; image?: ChatImageAttachment & { base64?: string } }[]
): Promise<Map<string, string>> {
    const entries = attachments.filter((entry) => Boolean(entry.image?.uri));
    const resolved = await Promise.all(
        entries.map(async (entry) => [entry.id, await resolveImageDataUrl(entry.image!)] as const)
    );
    const map = new Map<string, string>();
    resolved.forEach(([id, dataUrl]) => {
        if (dataUrl) map.set(id, dataUrl);
    });
    return map;
}
