import Constants from 'expo-constants';

const configuredVersion = Constants.expoConfig?.version
    ?? Constants.manifest?.version
    ?? '0.0.1';

export const APP_NAME = 'BlackroseJournal';
export const APP_TAGLINE = 'A local-first AI journal for reflection, memory, and intention.';
export const APP_VERSION = configuredVersion;

export const APP_ABOUT_COPY = [
    `${APP_NAME} v${APP_VERSION}`,
    APP_TAGLINE,
].join('\n\n');

export const APP_PRIVACY_COPY = [
    'Journal entries and local AI memory stay on this device by default.',
    'Network AI features send only the prompt context needed for the request you start.',
].join('\n\n');
