import { act, renderHook } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useChatImagePicker } from '../../hooks/chat/useChatImagePicker';
import { clearImageDataUrlCache, resolveImageDataUrl } from '@/services/ai/chatImage';

jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
    EncodingType: { Base64: 'base64' },
    readAsStringAsync: jest.fn(),
}));

const requestPermission = ImagePicker.requestMediaLibraryPermissionsAsync as jest.MockedFunction<
    typeof ImagePicker.requestMediaLibraryPermissionsAsync
>;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
    typeof ImagePicker.launchImageLibraryAsync
>;
const readAsStringAsync = FileSystem.readAsStringAsync as jest.MockedFunction<
    typeof FileSystem.readAsStringAsync
>;

function pickerResult(asset: Partial<ImagePicker.ImagePickerAsset> | null) {
    return {
        canceled: false,
        assets: asset ? [{ uri: 'file:///photo.jpg', width: 1200, height: 900, ...asset }] : null,
    } as unknown as ImagePicker.ImagePickerResult;
}

/** True when the bytes are still cached, i.e. the hook did not need the disk. */
async function bytesAreCached(uri: string): Promise<boolean> {
    readAsStringAsync.mockClear();
    await resolveImageDataUrl({ uri });
    return readAsStringAsync.mock.calls.length === 0;
}

beforeEach(() => {
    jest.clearAllMocks();
    clearImageDataUrlCache();
    readAsStringAsync.mockResolvedValue('FROM_DISK');
    requestPermission.mockResolvedValue({ granted: true } as never);
    launchLibrary.mockResolvedValue(pickerResult({ base64: 'PICKED', mimeType: 'image/jpeg' }));
});

describe('useChatImagePicker', () => {
    it('attaches the picked photo and keeps its bytes in memory for the send', async () => {
        const { result } = renderHook(() => useChatImagePicker());

        let picked: Awaited<ReturnType<typeof result.current.pickImage>> = null;
        await act(async () => {
            picked = await result.current.pickImage();
        });

        expect(picked).toMatchObject({
            uri: 'file:///photo.jpg',
            mimeType: 'image/jpeg',
            width: 1200,
            height: 900,
            base64: 'PICKED',
        });
        expect(result.current.pendingImage?.uri).toBe('file:///photo.jpg');
        expect(result.current.isPicking).toBe(false);
        await expect(bytesAreCached('file:///photo.jpg')).resolves.toBe(true);
    });

    it('asks for library permission first and attaches nothing when it is refused', async () => {
        requestPermission.mockResolvedValue({ granted: false } as never);
        const { result } = renderHook(() => useChatImagePicker());

        await act(async () => {
            await expect(result.current.pickImage()).resolves.toBeNull();
        });

        expect(launchLibrary).not.toHaveBeenCalled();
        expect(result.current.pendingImage).toBeNull();
    });

    it('attaches nothing when the picker is dismissed', async () => {
        launchLibrary.mockResolvedValue({ canceled: true, assets: null } as never);
        const { result } = renderHook(() => useChatImagePicker());

        await act(async () => {
            await expect(result.current.pickImage()).resolves.toBeNull();
        });

        expect(result.current.pendingImage).toBeNull();
    });

    it('attaches nothing when the picker returns no asset uri', async () => {
        launchLibrary.mockResolvedValue(pickerResult({ uri: '' }));
        const { result } = renderHook(() => useChatImagePicker());

        await act(async () => {
            await expect(result.current.pickImage()).resolves.toBeNull();
        });

        expect(result.current.pendingImage).toBeNull();
    });

    it('drops an oversized encoding but still attaches the photo', async () => {
        launchLibrary.mockResolvedValue(
            pickerResult({ base64: 'x'.repeat(12 * 1024 * 1024 + 1) })
        );
        const { result } = renderHook(() => useChatImagePicker());

        let picked: Awaited<ReturnType<typeof result.current.pickImage>> = null;
        await act(async () => {
            picked = await result.current.pickImage();
        });

        expect(picked?.base64).toBeUndefined();
        expect(result.current.pendingImage?.uri).toBe('file:///photo.jpg');
        // Nothing was primed, so the bytes will be read from disk at send time.
        await expect(bytesAreCached('file:///photo.jpg')).resolves.toBe(false);
    });

    it('survives a picker that throws, and warns instead of failing the turn', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        launchLibrary.mockRejectedValue(new Error('library unavailable'));
        const { result } = renderHook(() => useChatImagePicker());

        await act(async () => {
            await expect(result.current.pickImage()).resolves.toBeNull();
        });

        expect(result.current.pendingImage).toBeNull();
        expect(result.current.isPicking).toBe(false);
        warn.mockRestore();
    });

    it('refuses a second pick while one is still open', async () => {
        let release: (value: ImagePicker.ImagePickerResult) => void = () => undefined;
        launchLibrary.mockImplementation(
            () =>
                new Promise<ImagePicker.ImagePickerResult>((resolve) => {
                    release = resolve;
                })
        );
        const { result } = renderHook(() => useChatImagePicker());

        // The guard reads `isPicking` from the current render, so the second tap has
        // to happen after the first one has already committed that state.
        let first: Promise<unknown> = Promise.resolve();
        await act(async () => {
            first = result.current.pickImage();
        });
        expect(result.current.isPicking).toBe(true);

        let concurrent: Awaited<ReturnType<typeof result.current.pickImage>> = null;
        await act(async () => {
            concurrent = await result.current.pickImage();
        });

        expect(concurrent).toBeNull();
        expect(launchLibrary).toHaveBeenCalledTimes(1);

        await act(async () => {
            release(pickerResult({ base64: 'PICKED' }));
            await first;
        });
        expect(result.current.pendingImage?.uri).toBe('file:///photo.jpg');
    });

    it('forgets the removed photo so its bytes cannot leak into a later turn', async () => {
        const { result } = renderHook(() => useChatImagePicker());
        await act(async () => {
            await result.current.pickImage();
        });
        await expect(bytesAreCached('file:///photo.jpg')).resolves.toBe(true);

        act(() => result.current.removeImage());

        expect(result.current.pendingImage).toBeNull();
        await expect(bytesAreCached('file:///photo.jpg')).resolves.toBe(false);
    });

    it('forgets the previous photo when a different one is picked', async () => {
        const { result } = renderHook(() => useChatImagePicker());
        await act(async () => {
            await result.current.pickImage();
        });

        launchLibrary.mockResolvedValue(pickerResult({ uri: 'file:///second.jpg', base64: 'NEXT' }));
        await act(async () => {
            await result.current.pickImage();
        });

        expect(result.current.pendingImage?.uri).toBe('file:///second.jpg');
        await expect(bytesAreCached('file:///second.jpg')).resolves.toBe(true);
        await expect(bytesAreCached('file:///photo.jpg')).resolves.toBe(false);
    });

    it('clears the attachment once the send has committed', async () => {
        const { result } = renderHook(() => useChatImagePicker());
        await act(async () => {
            await result.current.pickImage();
        });

        act(() => result.current.consumeImage());

        expect(result.current.pendingImage).toBeNull();
    });
});
