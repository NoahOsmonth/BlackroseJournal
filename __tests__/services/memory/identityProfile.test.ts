/* eslint-disable import/first */

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
    },
}));

import {
    IDENTITY_PROFILE_CORRUPT_BACKUP_KEY,
    IDENTITY_PROFILE_STORAGE_KEY,
    applyIdentityPatch,
    buildIdentityContext,
    clearIdentityProfile,
    confirmIdentityPendingField,
    dismissIdentityPendingField,
    formatIdentityContext,
    getIdentityProfile,
    profileHasIdentity,
    resetIdentityStorageAdapter,
    setIdentityStorageAdapter,
    subscribeIdentityChanges,
} from '../../../services/memory/identityProfile';

interface InMemoryAdapter {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    store: Map<string, string>;
}

function createInMemoryAdapter(): InMemoryAdapter {
    const store = new Map<string, string>();
    return {
        store,
        async getItem(key: string) {
            return store.get(key) ?? null;
        },
        async setItem(key: string, value: string) {
            store.set(key, value);
        },
        async removeItem(key: string) {
            store.delete(key);
        },
    };
}

describe('identityProfile', () => {
    let adapter: InMemoryAdapter;

    beforeEach(() => {
        adapter = createInMemoryAdapter();
        setIdentityStorageAdapter(adapter);
    });

    afterEach(async () => {
        await clearIdentityProfile();
        resetIdentityStorageAdapter();
    });

    it('starts empty and builds no prompt block', async () => {
        const profile = await getIdentityProfile();
        expect(profileHasIdentity(profile)).toBe(false);
        expect(await buildIdentityContext()).toBeUndefined();
    });

    it('persists preferred name and always injects it outside capsule ranking', async () => {
        await applyIdentityPatch({
            preferredName: 'Sigurd',
            source: 'extraction',
            confidence: 0.95,
        });

        const ctx = await buildIdentityContext();
        expect(ctx).toContain('## Identity');
        expect(ctx).toContain('Preferred name: Sigurd');
        expect(ctx).not.toContain('Local Memory Capsule');
    });

    /**
     * Product rule: first capture auto-confirms — no PR7 UI required.
     * What would make this fail: mergeField writes first value only to pendingCandidate
     * (leaving value unset → empty ## Identity block forever without Settings).
     */
    it('auto-confirms first capture into value (not pendingCandidate)', async () => {
        const profile = await applyIdentityPatch({
            preferredName: 'Sigurd',
            source: 'extraction',
        });
        expect(profile.preferredName?.value).toBe('Sigurd');
        expect(profile.preferredName?.pendingCandidate).toBeUndefined();
        const raw = adapter.store.get(IDENTITY_PROFILE_STORAGE_KEY);
        // eslint-disable-next-line no-console
        console.log('[identity-diag] raw @rosebud_identity_profile first capture:', raw);
        expect(raw).toContain('"value":"Sigurd"');
        expect(raw).not.toContain('pendingCandidate');
        expect(await buildIdentityContext()).toContain('Preferred name: Sigurd');
    });

    /**
     * Design §6.3: never silently overwrite a *confirmed* value.
     * What would make this fail: mergeField auto-supersedes (old previousValues path)
     * so value becomes "Bob" without confirmIdentityPendingField.
     */
    it('holds contradicting name in pendingCandidate without changing active value', async () => {
        await applyIdentityPatch({ preferredName: 'Sigurd', source: 'extraction' });
        await applyIdentityPatch({
            preferredName: 'Bob',
            source: 'extraction',
            reason: 'joke or typo candidate',
        });

        const profile = await getIdentityProfile();
        expect(profile.preferredName?.value).toBe('Sigurd');
        expect(profile.preferredName?.pendingCandidate).toBe('Bob');
        expect(profile.preferredName?.previousValues).toBeUndefined();

        const ctx = await buildIdentityContext();
        expect(ctx).toContain('Preferred name: Sigurd');
        expect(ctx).not.toContain('Bob');
    });

    it('promotes pendingCandidate only after explicit confirm', async () => {
        await applyIdentityPatch({ preferredName: 'Sigurd', source: 'extraction' });
        await applyIdentityPatch({ preferredName: 'Sig', source: 'extraction' });

        let profile = await getIdentityProfile();
        expect(profile.preferredName?.value).toBe('Sigurd');
        expect(profile.preferredName?.pendingCandidate).toBe('Sig');

        profile = await confirmIdentityPendingField('preferredName');
        expect(profile.preferredName?.value).toBe('Sig');
        expect(profile.preferredName?.pendingCandidate).toBeUndefined();
        expect(profile.preferredName?.previousValues?.[0]?.value).toBe('Sigurd');
        expect(profile.preferredName?.previousValues?.[0]?.reason).toContain('confirmed');
    });

    it('dismisses pendingCandidate without changing active value', async () => {
        await applyIdentityPatch({ preferredName: 'Sigurd', source: 'extraction' });
        await applyIdentityPatch({ preferredName: 'Bob', source: 'tool' });
        await dismissIdentityPendingField('preferredName');

        const profile = await getIdentityProfile();
        expect(profile.preferredName?.value).toBe('Sigurd');
        expect(profile.preferredName?.pendingCandidate).toBeUndefined();
    });

    it('manual forceApply supersedes immediately with previousValues audit', async () => {
        await applyIdentityPatch({ preferredName: 'Sig', source: 'extraction' });
        await applyIdentityPatch({
            preferredName: 'Sigurd',
            source: 'manual',
            reason: 'user corrected name in Settings',
        });

        const profile = await getIdentityProfile();
        expect(profile.preferredName?.value).toBe('Sigurd');
        expect(profile.preferredName?.pendingCandidate).toBeUndefined();
        expect(profile.preferredName?.previousValues?.[0]?.value).toBe('Sig');
    });

    it('merges key people and facts without wiping the name', async () => {
        await applyIdentityPatch({ preferredName: 'Sigurd' });
        await applyIdentityPatch({
            keyPeople: [{ name: 'Ada', relation: 'partner' }],
            facts: ['night owl'],
        });

        const profile = await getIdentityProfile();
        expect(profile.preferredName?.value).toBe('Sigurd');
        expect(profile.keyPeople[0]?.name).toBe('Ada');
        expect(profile.facts[0]?.content).toBe('night owl');

        const ctx = formatIdentityContext(profile);
        expect(ctx).toContain('Sigurd');
        expect(ctx).toContain('Ada (partner)');
        expect(ctx).toContain('night owl');
    });

    it('notifies subscribers on write', async () => {
        const spy = jest.fn();
        const unsub = subscribeIdentityChanges(spy);
        await applyIdentityPatch({ preferredName: 'Sam' });
        expect(spy).toHaveBeenCalled();
        unsub();
    });

    it('recovers from corrupt JSON by backing up and returning empty', async () => {
        adapter.store.set(IDENTITY_PROFILE_STORAGE_KEY, '{not-json');
        const profile = await getIdentityProfile();
        expect(profileHasIdentity(profile)).toBe(false);
        expect(adapter.store.get(IDENTITY_PROFILE_CORRUPT_BACKUP_KEY)).toBe('{not-json');
    });

    it('serializes concurrent patches so no write is dropped', async () => {
        await Promise.all([
            applyIdentityPatch({ preferredName: 'A' }),
            applyIdentityPatch({ pronouns: 'they/them' }),
            applyIdentityPatch({ facts: ['lives in Oslo'] }),
        ]);
        const profile = await getIdentityProfile();
        expect(profile.preferredName?.value).toBe('A');
        expect(profile.pronouns?.value).toBe('they/them');
        expect(profile.facts.some((f) => f.content.includes('Oslo'))).toBe(true);
    });

    /**
     * Facts are capped at 24 but only 8 are ever injected; the 25th silently
     * drops the oldest-updated fact. The eviction must at least be visible in
     * the logs, mirroring the atom-cap warning in localMemory.
     */
    it('warns when identity facts exceed MAX_FACTS and are evicted', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const facts = Array.from({ length: 25 }, (_, i) => `fact number ${i + 1}`);
        await applyIdentityPatch({ facts });

        const profile = await getIdentityProfile();
        expect(profile.facts.length).toBe(24);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('Identity profile: evicted 1'),
        );
        warn.mockRestore();
    });

    /**
     * Key people are capped at 12 but the eviction was completely silent — a
     * person the user cares about was dropped with zero trace. It must announce
     * the drop the same way the facts path does (mirroring the atom-cap warning
     * in localMemory), so a shrinking people list is an event, not a mystery.
     */
    it('warns when identity key people exceed MAX_KEY_PEOPLE and are evicted', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const keyPeople = Array.from({ length: 15 }, (_, i) => ({ name: `Person ${i + 1}` }));
        await applyIdentityPatch({ keyPeople });

        const profile = await getIdentityProfile();
        expect(profile.keyPeople.length).toBe(12);
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('Identity profile: evicted 3'),
        );
        warn.mockRestore();
    });
});
