import Constants from 'expo-constants';

// The real version comes from `app.json` → `expo.version` through
// `expo-constants`; this literal is only the last-resort fallback for a host
// that exposes no config at all. Bump it with the manifest, don't rely on it.
const configuredVersion = Constants.expoConfig?.version
    ?? Constants.manifest?.version
    ?? '0.1.0';

export const APP_NAME = 'BlackroseJournal';
export const APP_TAGLINE = 'A private AI journal for reflection, memory, and intention.';
export const APP_VERSION = configuredVersion;

/** Where a crash report is filed. Opening it is always user-initiated. */
export const APP_REPO_URL = 'https://github.com/NoahOsmonth/BlackroseJournal';
export const APP_ISSUE_URL = `${APP_REPO_URL}/issues/new`;

export const APP_ABOUT_COPY = [
    `${APP_NAME} v${APP_VERSION}`,
    APP_TAGLINE,
].join('\n\n');

export const APP_PRIVACY_COPY = [
    'Journal entries and saved memories stay on this device by default.',
    'When you use AI, only the words needed for your request are sent.',
].join('\n\n');
