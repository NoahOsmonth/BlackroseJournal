/**
 * Sharing an entry as an image (Kaneo #14, PNG added in #54).
 *
 * The rasteriser is mocked because it IS the platform boundary: the real one
 * needs a browser canvas, which Jest does not have. Everything else here is the
 * real hook and the real markup builder.
 */
/* eslint-disable import/first -- the jest.mock factories must be declared before the
   imports they replace, or the real rasteriser and downloader load first. */
import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockPng = jest.fn<Promise<string | null>, [string, number]>();
jest.mock('@/utils/svgToPng', () => ({
    svgToPngDataUrl: (svg: string, width: number) => mockPng(svg, width),
}));

const mockDownloads: { name: string; body: string }[] = [];
jest.mock('@/components/ui/webDownload', () => ({
    downloadTextFile: (name: string, contents: string) => { mockDownloads.push({ name, body: contents }); return true; },
    downloadDataUrl: (name: string, url: string) => { mockDownloads.push({ name, body: url }); return true; },
}));

import { useEntryImage } from '@/hooks/journal/useEntryImage';

describe('useEntryImage', () => {
    beforeEach(() => {
        mockDownloads.length = 0;
        mockPng.mockReset();
    });

    it('saves a PNG when the platform can rasterise, because chat apps preview it', async () => {
        mockPng.mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
        const { result } = renderHook(() => useEntryImage());

        await act(async () => {
            await result.current.exportImage('First paragraph.\n\nSecond paragraph.', '8 Nov 2026', false);
        });

        await waitFor(() => expect(mockDownloads).toHaveLength(1));
        expect(mockDownloads[0].name).toBe('blackrose-8-Nov-2026.png');
        expect(mockDownloads[0].body.startsWith('data:image/png;base64,')).toBe(true);
        expect(result.current.message).toBe('Image saved to your downloads.');
    });

    it('keeps the SVG when it cannot rasterise, instead of failing the export', async () => {
        mockPng.mockResolvedValue(null);
        const { result } = renderHook(() => useEntryImage());

        await act(async () => {
            await result.current.exportImage('Only one paragraph.', '8 Nov 2026', true);
        });

        await waitFor(() => expect(mockDownloads).toHaveLength(1));
        expect(mockDownloads[0].name).toBe('blackrose-8-Nov-2026.svg');
        expect(mockDownloads[0].body).toContain('<svg');
        expect(mockDownloads[0].body).toContain('Only one paragraph.');
        expect(result.current.message).toBe('Image saved to your downloads.');
    });

    it('asks for the card at 1080 wide, the size the layout is drawn for', async () => {
        mockPng.mockResolvedValue('data:image/png;base64,x');
        const { result } = renderHook(() => useEntryImage());
        await act(async () => {
            await result.current.exportImage('Words.', '8 Nov 2026', false);
        });
        expect(mockPng.mock.calls[0][1]).toBe(1080);
    });

    it('says so instead of exporting an empty entry', async () => {
        const { result } = renderHook(() => useEntryImage());
        await act(async () => {
            await result.current.exportImage('   ', '8 Nov 2026', false);
        });
        expect(mockDownloads).toHaveLength(0);
        expect(result.current.message).toBe('There is nothing in this entry to share yet.');
    });
});
