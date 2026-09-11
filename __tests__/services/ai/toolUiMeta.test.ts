import {
    formatToolArgsPreview,
    formatToolResultPreview,
    getToolUiMeta,
    listToolsMissingUiMeta,
    MAX_ARGS_PREVIEW_CHARS,
    TOOL_UI_META,
} from '../../../services/ai/tools/toolUiMeta';
import { HISTORY_TOOL_DEFINITIONS } from '../../../services/ai/tools/definitions';

describe('toolUiMeta', () => {
    it('has meta for every registry tool', () => {
        expect(listToolsMissingUiMeta()).toEqual([]);
        HISTORY_TOOL_DEFINITIONS.forEach((def) => {
            expect(TOOL_UI_META[def.name]).toBeTruthy();
            expect(getToolUiMeta(def.name).label.length).toBeGreaterThan(0);
        });
    });

    it('uses unique human labels', () => {
        const labels = Object.values(TOOL_UI_META).map((meta) => meta.label);
        expect(new Set(labels).size).toBe(labels.length);
    });

    it('never dumps args previews longer than the cap', () => {
        const longQuery = 'work stress '.repeat(40);
        const preview = formatToolArgsPreview(
            'search_history',
            JSON.stringify({ query: longQuery })
        );
        expect(preview.length).toBeLessThanOrEqual(MAX_ARGS_PREVIEW_CHARS);
        expect(preview.endsWith('…')).toBe(true);
    });

    it('falls back safely for unknown tools and bad JSON', () => {
        expect(getToolUiMeta('not_a_tool').label).toBe('Using a tool');
        expect(formatToolArgsPreview('get_day', 'not-json')).toBe('day');
    });

    it('formats known args previews', () => {
        expect(formatToolArgsPreview('get_clock', '{}')).toBe('—');
        expect(formatToolArgsPreview('list_recent_days', '{"days":7}')).toBe('7 days');
        expect(formatToolArgsPreview('get_day', '{"date":"yesterday"}')).toBe('yesterday');
        expect(formatToolArgsPreview('search_history', '{"query":"work stress"}')).toBe('work stress');
        expect(formatToolArgsPreview('create_goal', '{"title":"Run 3x/week"}')).toBe('Run 3x/week');
    });

    it('teaches a one-line result preview', () => {
        const preview = formatToolResultPreview('get_day', {
            toolCallId: 'c1',
            name: 'get_day',
            content: 'date: 2026-07-12\nsummary: Sleep was rough\nmore lines…',
        });
        expect(preview).toBe('date: 2026-07-12');
    });
});
