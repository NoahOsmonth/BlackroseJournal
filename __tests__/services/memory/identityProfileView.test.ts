import type { IdentityProfile } from '../../../services/memory/identityProfile.types';
import {
    countPendingIdentityCandidates,
    humanizeIdentityFieldKey,
    identitySettingsSummary,
    listPendingIdentityCandidates,
    listScalarIdentityRows,
} from '../../../services/memory/identityProfileView';

function field(value: string, pending?: string) {
    return {
        value,
        confidence: 0.9,
        source: 'extraction' as const,
        updatedAt: 1,
        pendingCandidate: pending,
    };
}

const base: IdentityProfile = {
    schemaVersion: 1,
    keyPeople: [],
    facts: [],
    updatedAt: 1,
};

describe('identityProfileView', () => {
    it('humanizes field keys without special-casing name', () => {
        expect(humanizeIdentityFieldKey('preferredName')).toBe('Preferred name');
        expect(humanizeIdentityFieldKey('pronouns')).toBe('Pronouns');
        expect(humanizeIdentityFieldKey('about')).toBe('About');
    });

    it('lists scalar rows generically and pending candidates', () => {
        const profile: IdentityProfile = {
            ...base,
            preferredName: field('Mara', 'Ren'),
            pronouns: field('she/her'),
            about: field('Writer', 'Painter'),
        };
        const rows = listScalarIdentityRows(profile);
        expect(rows.map((r) => r.key)).toEqual(['preferredName', 'pronouns', 'about']);
        const pending = listPendingIdentityCandidates(profile);
        expect(pending).toHaveLength(2);
        expect(pending.map((p) => p.key).sort()).toEqual(['about', 'preferredName']);
        expect(countPendingIdentityCandidates(profile)).toBe(2);
        expect(identitySettingsSummary(profile)).toBe('2 pending changes');
    });

    it('summarizes empty and confirmed-only profiles', () => {
        expect(identitySettingsSummary(null)).toBe('Not set');
        expect(identitySettingsSummary(base)).toBe('Not set');
        expect(identitySettingsSummary({
            ...base,
            preferredName: field('Mara'),
        })).toBe('Mara');
    });
});
