/* eslint-disable import/first */

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        expoConfig: { version: '0.0.1' },
        manifest: {},
    },
}));

import {
    APP_ABOUT_COPY,
    APP_NAME,
    APP_PRIVACY_COPY,
    APP_VERSION,
} from '../../constants/appInfo';

describe('appInfo constants', () => {
    const pkg = require('../../package.json') as { version: string };

    it('uses real app identity and configured package version', () => {
        expect(APP_NAME).toBe('BlackroseJournal');
        expect(APP_VERSION).toBe(pkg.version);
        expect(APP_ABOUT_COPY).toContain('BlackroseJournal');
        expect(APP_ABOUT_COPY).toContain(`v${pkg.version}`);
        expect(APP_ABOUT_COPY).not.toContain('Journal App v1.0.0');
    });

    it('describes local-first privacy behavior', () => {
        expect(APP_PRIVACY_COPY).toContain('stay on this device');
        expect(APP_PRIVACY_COPY).toContain('Network AI features');
    });
});
