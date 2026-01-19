import { execSync } from 'child_process';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');

const getTrackedEnvFiles = (): string[] => {
    try {
        const output = execSync('git ls-files .env', {
            cwd: PROJECT_ROOT,
            stdio: ['ignore', 'pipe', 'pipe'],
        })
            .toString()
            .trim();

        if (!output) {
            return [];
        }

        return output.split(/\r?\n/).filter(Boolean);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown git error';
        throw new Error(`Unable to verify tracked .env files. ${message}`);
    }
};

describe('.env tracking', () => {
    it('does not track .env', () => {
        expect(getTrackedEnvFiles()).toEqual([]);
    });
});
