import {
    filterModels,
    formatPickerModelName,
    hostLabelFromBaseUrl,
    matchesModelFilter,
    pickModelFromList,
    pushRecentModelId,
} from '../../../utils/ai/modelDisplay';

describe('matchesModelFilter', () => {
    it('passes every model when no patterns are configured', () => {
        expect(matchesModelFilter('openai/gpt-4')).toBe(true);
        expect(matchesModelFilter('tencent/hy3:free')).toBe(true);
    });

    it('matches case-insensitive substrings', () => {
        expect(matchesModelFilter('tencent/hy3:free', [':free'])).toBe(true);
        expect(matchesModelFilter('zenmux/z-ai/glm-5.3-free', ['-free'])).toBe(true);
        expect(matchesModelFilter('OPENAI/GPT-4', [':free'])).toBe(false);
    });

    it('lets the user filter by provider prefix without the app hardcoding it', () => {
        expect(matchesModelFilter('qwen-web/qwen3.8-max', ['qwen-web/'])).toBe(true);
        expect(matchesModelFilter('openai/gpt-4', ['qwen-web/'])).toBe(false);
    });

    it('treats a blank-only pattern list as no filter', () => {
        expect(matchesModelFilter('openai/gpt-4', ['', '   '])).toBe(true);
    });

    it('never matches an empty model id against a real pattern', () => {
        expect(matchesModelFilter('', [':free'])).toBe(false);
    });
});

describe('filterModels', () => {
    it('keeps only ids matching the configured patterns', () => {
        const models = [
            { id: 'openai/gpt-4' },
            { id: 'tencent/hy3:free' },
            { id: 'zenmux/glm-5.3-free' },
        ];
        expect(filterModels(models, [':free', '-free']).map((m) => m.id)).toEqual([
            'tencent/hy3:free',
            'zenmux/glm-5.3-free',
        ]);
    });

    it('returns the list untouched with no patterns', () => {
        const models = [{ id: 'a' }, { id: 'b' }];
        expect(filterModels(models)).toEqual(models);
    });
});

describe('pickModelFromList', () => {
    const models = [{ id: 'a/one' }, { id: 'b/two' }];

    it('keeps the previous selection when the provider still serves it', () => {
        expect(pickModelFromList(models, 'b/two', 'a/one')).toBe('b/two');
    });

    it('falls back to the env seed when the previous selection is gone', () => {
        expect(pickModelFromList(models, 'gone/three', 'b/two')).toBe('b/two');
    });

    it('falls back to the first model when neither is served', () => {
        expect(pickModelFromList(models, 'gone/three', 'also-gone/four')).toBe('a/one');
    });

    it('returns null for an empty list', () => {
        expect(pickModelFromList([], 'a/one', 'b/two')).toBeNull();
    });
});

describe('hostLabelFromBaseUrl', () => {
    it('reads the hostname from a base URL', () => {
        expect(hostLabelFromBaseUrl('https://api.example.com/v1')).toBe('api.example.com');
        expect(hostLabelFromBaseUrl('http://192.168.1.10:8080/v1')).toBe('192.168.1.10');
    });

    it('degrades to a neutral label for unusable input', () => {
        expect(hostLabelFromBaseUrl('')).toBe('provider');
        expect(hostLabelFromBaseUrl('not a url')).toBe('provider');
    });
});

describe('formatPickerModelName', () => {
    it('drops the path prefix and the free routing tag', () => {
        expect(formatPickerModelName('tencent/hy3:free')).toBe('hy3');
        expect(formatPickerModelName('zenmux/glm-5.3-free')).toBe('glm 5.3');
    });

    it('strips thinking tags and tidies known families', () => {
        expect(formatPickerModelName('moonshotai/kimi-k2.5:thinking')).toBe('Kimi K2.5');
    });

    it('returns the raw id when nothing is left to show', () => {
        expect(formatPickerModelName(':free')).toBe(':free');
    });
});

describe('pushRecentModelId', () => {
    it('moves the id to the front and caps the list', () => {
        expect(pushRecentModelId(['a', 'b'], 'c')).toEqual(['c', 'a', 'b']);
        expect(pushRecentModelId(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
        expect(pushRecentModelId(['a', 'b'], 'a')).toEqual(['a', 'b']);
    });
});
