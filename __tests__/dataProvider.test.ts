import {
    getActiveDataProvider,
    isRemoteDataSyncEnabled,
} from '../services/data/dataProvider';

describe('dataProvider', () => {
    const originalDataProvider = process.env.EXPO_PUBLIC_DATA_PROVIDER;
    const originalRemoteFlag = process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

    afterEach(() => {
        process.env.EXPO_PUBLIC_DATA_PROVIDER = originalDataProvider;
        process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC = originalRemoteFlag;
    });

    it('defaults app data to local-only storage', () => {
        delete process.env.EXPO_PUBLIC_DATA_PROVIDER;
        delete process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

        expect(getActiveDataProvider()).toBe('local');
        expect(isRemoteDataSyncEnabled()).toBe(false);
    });

    it('enables remote data sync only when explicitly requested', () => {
        process.env.EXPO_PUBLIC_DATA_PROVIDER = 'remote';
        delete process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC;

        expect(getActiveDataProvider()).toBe('remote');
        expect(isRemoteDataSyncEnabled()).toBe(true);
    });

    it('treats unknown provider values as local-only', () => {
        process.env.EXPO_PUBLIC_DATA_PROVIDER = 'cloud';
        process.env.EXPO_PUBLIC_ENABLE_REMOTE_DATA_SYNC = 'no';

        expect(getActiveDataProvider()).toBe('local');
        expect(isRemoteDataSyncEnabled()).toBe(false);
    });
});
