import * as Linking from 'expo-linking';

export interface AuthLinkTokens {
    accessToken?: string;
    refreshToken?: string;
    type?: string;
    errorDescription?: string;
}

function parseParams(value: string): Record<string, string> {
    const params = new URLSearchParams(value);
    const entries: Record<string, string> = {};
    params.forEach((val, key) => {
        entries[key] = val;
    });
    return entries;
}

export function getPasswordResetRedirectUrl(): string {
    return Linking.createURL('/update-password');
}

export function extractAuthLinkTokens(url: string): AuthLinkTokens {
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');

    const hashParams = hashIndex >= 0 ? parseParams(url.slice(hashIndex + 1)) : {};
    const queryParams = queryIndex >= 0
        ? parseParams(url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined))
        : {};

    const combined = { ...queryParams, ...hashParams };

    return {
        accessToken: combined.access_token,
        refreshToken: combined.refresh_token,
        type: combined.type,
        errorDescription: combined.error_description || combined.error,
    };
}
