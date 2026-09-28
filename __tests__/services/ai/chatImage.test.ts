import * as FileSystem from 'expo-file-system/legacy';

import {
    clearImageDataUrlCache,
    forgetImageDataUrl,
    primeImageDataUrl,
    resolveImageDataUrl,
    resolveImageDataUrls,
} from '@/services/ai/chatImage';

/**
 * The web branch of `readBase64FromUri` (fetch + FileReader) is exercised for real
 * by the browser gate (`scripts/e2e/pw-chat-surface-verify.mjs`), so these tests
 * pin the native path, where a silent failure would mean a photo that never
 * reaches the provider.
 */
jest.mock('expo-file-system/legacy', () => ({
    EncodingType: { Base64: 'base64' },
    readAsStringAsync: jest.fn(),
}));

const readAsStringAsync = FileSystem.readAsStringAsync as jest.MockedFunction<
    typeof FileSystem.readAsStringAsync
>;

/** One char past the module's 12 MB ceiling. */
const OVERSIZE_BASE64 = 'x'.repeat(12 * 1024 * 1024 + 1);

beforeEach(() => {
    jest.clearAllMocks();
    clearImageDataUrlCache();
    readAsStringAsync.mockResolvedValue('FROM_DISK');
});

describe('resolveImageDataUrl', () => {
    it('builds a data URL from the picker bytes without touching the file system', async () => {
        const dataUrl = await resolveImageDataUrl({
            uri: 'file:///photo.jpg',
            mimeType: 'image/jpeg',
            base64: 'PICKED',
        });

        expect(dataUrl).toBe('data:image/jpeg;base64,PICKED');
        expect(readAsStringAsync).not.toHaveBeenCalled();
    });

    it('reuses the cached encoding instead of re-reading the photo every turn', async () => {
        const attachment = { uri: 'file:///photo.jpg', mimeType: 'image/png', base64: 'PICKED' };

        const first = await resolveImageDataUrl(attachment);
        const second = await resolveImageDataUrl(attachment);

        expect(first).toBe('data:image/png;base64,PICKED');
        expect(second).toBe(first);
        expect(readAsStringAsync).not.toHaveBeenCalled();
    });

    it('reads the bytes off disk when the picker did not hand any over', async () => {
        const dataUrl = await resolveImageDataUrl({ uri: 'file:///photo.jpg' });

        expect(readAsStringAsync).toHaveBeenCalledWith('file:///photo.jpg', {
            encoding: 'base64',
        });
        expect(dataUrl).toBe('data:image/jpeg;base64,FROM_DISK');
    });

    it('degrades to null when the bytes are gone, so the turn still sends as text', async () => {
        readAsStringAsync.mockRejectedValue(new Error('file deleted'));

        await expect(resolveImageDataUrl({ uri: 'file:///gone.jpg' })).resolves.toBeNull();
    });

    it('returns null for an attachment with no uri', async () => {
        await expect(resolveImageDataUrl({ uri: '' })).resolves.toBeNull();
        expect(readAsStringAsync).not.toHaveBeenCalled();
    });

    it('refuses an encoding past the size ceiling rather than writing a giant key', async () => {
        const dataUrl = await resolveImageDataUrl({
            uri: 'file:///huge.jpg',
            base64: OVERSIZE_BASE64,
        });

        expect(dataUrl).toBeNull();
    });

    describe('mime type normalization', () => {
        const cases: [string | undefined, string][] = [
            [undefined, 'image/jpeg'],
            ['image/png', 'image/png'],
            [' IMAGE/WEBP ', 'image/webp'],
            ['application/pdf', 'image/jpeg'],
            ['', 'image/jpeg'],
        ];

        it.each(cases)('maps %p to %p', async (mimeType, expected) => {
            const dataUrl = await resolveImageDataUrl({
                uri: `file:///photo-${expected}-${String(mimeType)}`,
                mimeType,
                base64: 'PICKED',
            });

            expect(dataUrl).toBe(`data:${expected};base64,PICKED`);
        });
    });
});

describe('forgetImageDataUrl', () => {
    it('drops the cache so a removed attachment is re-read rather than reused', async () => {
        const attachment = { uri: 'file:///photo.jpg', mimeType: 'image/png', base64: 'PICKED' };
        await resolveImageDataUrl(attachment);

        forgetImageDataUrl('file:///photo.jpg');
        const afterForget = await resolveImageDataUrl({ uri: 'file:///photo.jpg' });

        expect(readAsStringAsync).toHaveBeenCalledTimes(1);
        expect(afterForget).toBe('data:image/jpeg;base64,FROM_DISK');
    });
});

describe('primeImageDataUrl', () => {
    it('caches the picker bytes so the first send does not re-read the file', async () => {
        primeImageDataUrl({ uri: 'file:///photo.jpg', mimeType: 'image/png', base64: 'PICKED' });

        await expect(resolveImageDataUrl({ uri: 'file:///photo.jpg' })).resolves.toBe(
            'data:image/png;base64,PICKED'
        );
        expect(readAsStringAsync).not.toHaveBeenCalled();
    });

    it('ignores an attachment with no bytes to prime', async () => {
        primeImageDataUrl({ uri: 'file:///photo.jpg' });

        await resolveImageDataUrl({ uri: 'file:///photo.jpg' });
        expect(readAsStringAsync).toHaveBeenCalledTimes(1);
    });

    it('refuses to prime an encoding past the size ceiling', async () => {
        primeImageDataUrl({ uri: 'file:///huge.jpg', base64: OVERSIZE_BASE64 });

        await resolveImageDataUrl({ uri: 'file:///huge.jpg' });
        expect(readAsStringAsync).toHaveBeenCalledTimes(1);
    });
});

describe('resolveImageDataUrls', () => {
    it('maps only the turns whose bytes are actually available', async () => {
        readAsStringAsync.mockImplementation(async (uri: string) => {
            if (uri === 'file:///gone.jpg') throw new Error('file deleted');
            return 'FROM_DISK';
        });

        const map = await resolveImageDataUrls([
            { id: 'm1', image: { uri: 'file:///photo.jpg', base64: 'PICKED' } },
            { id: 'm2', image: { uri: 'file:///gone.jpg' } },
            { id: 'm3' },
            { id: 'm4', image: { uri: '' } },
        ]);

        expect([...map.keys()]).toEqual(['m1']);
        expect(map.get('m1')).toBe('data:image/jpeg;base64,PICKED');
    });

    it('returns an empty map when no turn carries a photo', async () => {
        const map = await resolveImageDataUrls([{ id: 'm1' }, { id: 'm2' }]);

        expect(map.size).toBe(0);
        expect(readAsStringAsync).not.toHaveBeenCalled();
    });
});
