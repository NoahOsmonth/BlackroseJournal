import { spawnSync } from 'child_process';
import path from 'path';

const script = path.resolve(__dirname, '../../scripts/phase1/deploy-heroku.mjs');

describe('deploy-heroku', () => {
    it('prints a secret-free checked deployment plan without invoking Heroku', () => {
        const result = spawnSync(process.execPath, [script, '--dry-run', '--app', 'blackrosejournal-api', '--expected-app-id', '297b095b-5207-4303-9b14-76609465aa75', '--expected-commit', 'abcdef0123456789'], { encoding: 'utf8' });

        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/blackrosejournal-api/);
        expect(result.stdout).toMatch(/configKeyNames/);
        expect(result.stdout).not.toMatch(/HEROKU_API_KEY|DATABASE_URL|token=/i);
    });
});
