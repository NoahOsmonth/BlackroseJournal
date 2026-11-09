import { act, renderHook } from '@testing-library/react-native';

import { useEntryPicker } from '@/hooks/journal/useEntryPicker';

function setup(tagsByEntry: Record<string, readonly string[]> = {}) {
    const added: [readonly string[], string][] = [];
    const removed: [readonly string[], string][] = [];
    const deps = {
        tagsByEntry,
        addTagMany: async (ids: readonly string[], label: string) => { added.push([ids, label]); },
        removeTagMany: async (ids: readonly string[], label: string) => { removed.push([ids, label]); },
    };
    const view = renderHook(() => useEntryPicker(deps));
    return { ...view, added, removed };
}

describe('useEntryPicker', () => {
    it('starts off and picks nothing', () => {
        const { result } = setup();
        expect(result.current.picking).toBe(false);
        expect(result.current.picked).toEqual([]);
    });

    it('toggles a row on and off while picking', () => {
        const { result } = setup();
        act(() => { result.current.toggle('a'); });
        act(() => { result.current.toggle('b'); });
        expect(result.current.picked).toEqual(['a', 'b']);
        act(() => { result.current.toggle('a'); });
        expect(result.current.picked).toEqual(['b']);
    });

    it('drops every pick when picking stops, so nothing labels later', () => {
        const { result } = setup();
        act(() => { result.current.togglePicking(); });
        act(() => { result.current.toggle('a'); });
        expect(result.current.picked).toEqual(['a']);
        act(() => { result.current.togglePicking(); });
        expect(result.current.picking).toBe(false);
        expect(result.current.picked).toEqual([]);
    });

    it('picks every row on screen with one call', () => {
        const { result } = setup();
        act(() => { result.current.pickAll(['a', 'b', 'c']); });
        expect(result.current.picked).toEqual(['a', 'b', 'c']);
    });

    it('never lists the same row twice when picking all', () => {
        const { result } = setup();
        act(() => { result.current.pickAll(['a', 'a', 'b']); });
        expect(result.current.picked).toEqual(['a', 'b']);
    });

    it('picking all of an empty screen picks nothing', () => {
        const { result } = setup();
        act(() => { result.current.pickAll([]); });
        expect(result.current.picked).toEqual([]);
    });

    it('reports only the labels the whole selection shares', () => {
        const { result } = setup({ a: ['trip', 'work'], b: ['trip'] });
        act(() => { result.current.toggle('a'); });
        act(() => { result.current.toggle('b'); });
        expect(result.current.shared).toEqual(['trip']);
    });

    it('adds a label to the whole batch in one call, then leaves pick mode', () => {
        const { result, added } = setup();
        act(() => { result.current.togglePicking(); });
        act(() => { result.current.toggle('a'); });
        act(() => { result.current.toggle('b'); });
        act(() => { result.current.openSheet('add'); });
        act(() => { result.current.submit('trip'); });
        expect(added).toEqual([[['a', 'b'], 'trip']]);
        expect(result.current.picking).toBe(false);
        expect(result.current.picked).toEqual([]);
        expect(result.current.sheetOpen).toBe(false);
    });

    it('removes a label from the whole batch in one call', () => {
        const { result, removed, added } = setup();
        act(() => { result.current.toggle('a'); });
        act(() => { result.current.openSheet('remove'); });
        act(() => { result.current.submit('trip'); });
        expect(removed).toEqual([[['a'], 'trip']]);
        expect(added).toEqual([]);
    });

    it('submitting with nothing picked writes nothing', () => {
        const { result, added, removed } = setup();
        act(() => { result.current.openSheet('add'); });
        act(() => { result.current.submit('trip'); });
        expect(added).toEqual([]);
        expect(removed).toEqual([]);
        expect(result.current.sheetOpen).toBe(false);
    });
});
