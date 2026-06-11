import { execFileSync } from 'child_process';
import path from 'path';

describe('gitignore service data modules', () => {
    it('does not ignore the data provider service used by EAS builds', () => {
        const projectRoot = path.resolve(__dirname, '..');

        try {
            execFileSync('git', ['check-ignore', '-v', 'services/data/dataProvider.ts'], {
                cwd: projectRoot,
                encoding: 'utf8',
                stdio: 'pipe',
            });
        } catch (error) {
            if ((error as NodeJS.ErrnoException & { status?: number }).status === 1) {
                return;
            }

            throw error;
        }

        throw new Error('services/data/dataProvider.ts is ignored and will be missing from EAS builds.');
    });
});
