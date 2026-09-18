/**
 * DEF-010 guard: `Share.share` is a no-op under react-native-web, so the journal
 * export must reach the browser as a real download. `downloadTextFile` returns
 * false when the DOM is unavailable, which keeps the native Share path.
 */

import { downloadTextFile } from '../../components/ui/webDownload';

type AnchorStub = { href: string; download: string; rel: string; click: jest.Mock; remove: jest.Mock };

describe('downloadTextFile', () => {
    const host = globalThis as unknown as { document?: unknown; Blob?: unknown; URL?: unknown };
    const original = { document: host.document, Blob: host.Blob, URL: host.URL };
    let anchor: AnchorStub;
    let appendChild: jest.Mock;
    let revokeObjectURL: jest.Mock;

    beforeEach(() => {
        anchor = { href: '', download: '', rel: '', click: jest.fn(), remove: jest.fn() };
        appendChild = jest.fn();
        revokeObjectURL = jest.fn();
        host.document = { createElement: jest.fn(() => anchor), body: { appendChild } };
        host.Blob = class {
            constructor(public parts: unknown[], public options: unknown) {}
        };
        host.URL = { createObjectURL: jest.fn(() => 'blob:blackrose-1'), revokeObjectURL };
    });

    afterEach(() => {
        host.document = original.document;
        host.Blob = original.Blob;
        host.URL = original.URL;
    });

    it('triggers a download named by the caller', () => {
        const ok = downloadTextFile('blackrose-journal-2026-09-17.json', '{"entries":[]}');

        expect(ok).toBe(true);
        expect(anchor.download).toBe('blackrose-journal-2026-09-17.json');
        expect(anchor.href).toBe('blob:blackrose-1');
        expect(appendChild).toHaveBeenCalledWith(anchor);
        expect(anchor.click).toHaveBeenCalledTimes(1);
    });

    it('cleans up the object URL and the anchor element', () => {
        downloadTextFile('export.json', '{}');

        expect(anchor.remove).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:blackrose-1');
    });

    it('returns false without a DOM so callers can fall back to the share sheet', () => {
        host.document = undefined;

        expect(downloadTextFile('export.json', '{}')).toBe(false);
    });

    it('returns false when the environment has no blob URL support', () => {
        host.URL = {};

        expect(downloadTextFile('export.json', '{}')).toBe(false);
    });
});
