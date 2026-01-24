import { extractAuthLinkTokens, getPasswordResetRedirectUrl } from '@/services/auth/authLinking';
import * as Linking from 'expo-linking';

jest.mock('expo-linking', () => ({
    createURL: jest.fn(() => 'app://update-password'),
}));

describe('authLinking', () => {
    it('extracts tokens from hash params', () => {
        const tokens = extractAuthLinkTokens('app://update-password#access_token=token&refresh_token=refresh&type=recovery');
        expect(tokens.accessToken).toBe('token');
        expect(tokens.refreshToken).toBe('refresh');
        expect(tokens.type).toBe('recovery');
    });

    it('extracts tokens from query params', () => {
        const tokens = extractAuthLinkTokens('app://update-password?access_token=token2&refresh_token=refresh2&type=recovery');
        expect(tokens.accessToken).toBe('token2');
        expect(tokens.refreshToken).toBe('refresh2');
        expect(tokens.type).toBe('recovery');
    });

    it('builds reset redirect URL', () => {
        const url = getPasswordResetRedirectUrl();
        expect(Linking.createURL).toHaveBeenCalledWith('/update-password');
        expect(url).toBe('app://update-password');
    });
});
