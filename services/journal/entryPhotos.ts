/**
 * One photo per entry (Kaneo #106).
 *
 * Its own key per entry, never a field on the entry. The entries collection is
 * read on every screen; a 400 KB data URL inside it would slow all of them and
 * risk the Android per-value ceiling that sharding exists to avoid.
 *
 * One module owns these keys, and it goes through the account-scoped adapter like
 * every other stored collection, so a photo belongs to the account that took it.
 * Every write runs through the lock (rule 4) and every parse is guarded: a
 * half-written photo must render nothing rather than crash a screen.
 */
import { getStorageForAccount } from '@/services/account/accountScopedStorage';
import { runAccountBoundOperation } from '@/services/account/accountRuntime';

const KEY_PREFIX = '@blackrose_entry_photo:';
const SCHEMA_VERSION = 1;

/** Longest edge after downscaling. Big enough for a phone screen, small enough
 * that a compressed photo stays well under a megabyte. */
export const PHOTO_MAX_EDGE = 1200;

/** Hard ceiling for the stored string. Above this the photo is refused with a
 * sentence instead of being written and slowing every read of the key. */
export const PHOTO_MAX_BYTES = 900_000;

export const PHOTO_QUALITY = 0.72;

export interface EntryPhoto {
    /** data:image/jpeg;base64,... - already compressed on the device. */
    readonly dataUrl: string;
    readonly width: number;
    readonly height: number;
    readonly updatedAt: number;
}

interface StoredPhoto {
    schemaVersion: number;
    dataUrl: string;
    width: number;
    height: number;
    updatedAt: number;
}

export function photoStorageKey(entryId: string): string {
    return KEY_PREFIX + entryId;
}

/** Longest edge -> the size to draw at, never upscaling a small photo. */
export function fitWithin(
    width: number,
    height: number,
    maxEdge: number = PHOTO_MAX_EDGE,
): { width: number; height: number } {
    const longest = Math.max(width, height);
    if (!Number.isFinite(longest) || longest <= 0) return { width: 0, height: 0 };
    if (longest <= maxEdge) return { width: Math.round(width), height: Math.round(height) };
    const scale = maxEdge / longest;
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function isTooLarge(dataUrl: string): boolean {
    return dataUrl.length > PHOTO_MAX_BYTES;
}

function parsePhoto(raw: string | null): EntryPhoto | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<StoredPhoto>;
        if (typeof parsed.dataUrl !== 'string' || !parsed.dataUrl.startsWith('data:image/')) return null;
        if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
        return {
            dataUrl: parsed.dataUrl,
            width: typeof parsed.width === 'number' ? parsed.width : 0,
            height: typeof parsed.height === 'number' ? parsed.height : 0,
            updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
        };
    } catch {
        return null;
    }
}

// Serialized so two saves for the same entry cannot interleave.
let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(work: () => Promise<T>): Promise<T> {
    const run = queue.then(work, work);
    queue = run.then(() => undefined, () => undefined);
    return run;
}

export async function readEntryPhoto(entryId: string): Promise<EntryPhoto | null> {
    if (!entryId) return null;
    try {
        return await runAccountBoundOperation('entry-photo', async ({ accountId }) =>
            parsePhoto(await getStorageForAccount(accountId).getItem(photoStorageKey(entryId))),
        );
    } catch {
        return null;
    }
}

/** Returns false when the photo was refused, so the caller can say why. */
export async function saveEntryPhoto(
    entryId: string,
    photo: { dataUrl: string; width: number; height: number },
): Promise<boolean> {
    if (!entryId || !photo.dataUrl.startsWith('data:image/')) return false;
    if (isTooLarge(photo.dataUrl)) return false;
    return withLock(async () => {
        const stored: StoredPhoto = {
            schemaVersion: SCHEMA_VERSION,
            dataUrl: photo.dataUrl,
            width: photo.width,
            height: photo.height,
            updatedAt: Date.now(),
        };
        try {
            await runAccountBoundOperation('entry-photo', async ({ accountId }) =>
                getStorageForAccount(accountId).setItem(photoStorageKey(entryId), JSON.stringify(stored)),
            );
            return true;
        } catch {
            return false;
        }
    });
}

export async function removeEntryPhoto(entryId: string): Promise<void> {
    if (!entryId) return;
    await withLock(async () => {
        try {
            await runAccountBoundOperation('entry-photo', async ({ accountId }) =>
                getStorageForAccount(accountId).removeItem(photoStorageKey(entryId)),
            );
        } catch {
            // Nothing to undo: the photo is already unreadable.
        }
    });
}
