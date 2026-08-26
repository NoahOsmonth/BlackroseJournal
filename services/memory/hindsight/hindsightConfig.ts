/** The mobile app can reach memory only through the authenticated AI gateway. */
export interface HindsightConfig { baseUrl: string; enabled: boolean }
export function getHindsightConfig(): HindsightConfig {
    const rawBaseUrl = process.env.EXPO_PUBLIC_AGENT_BASE_URL?.trim();
    if (!rawBaseUrl) return { baseUrl: '', enabled: false };
    return { baseUrl: rawBaseUrl.replace(/\/+$/, ''), enabled: true };
}
export function isHindsightEnabled(): boolean { return getHindsightConfig().enabled; }
