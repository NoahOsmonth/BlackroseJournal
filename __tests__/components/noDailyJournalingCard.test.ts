import fs from 'fs';
import path from 'path';

describe('DailyJournalingCard cleanup', () => {
    it('keeps the dead prototype card removed from production components', () => {
        expect(
            fs.existsSync(path.join(process.cwd(), 'components/today/DailyJournalingCard.tsx'))
        ).toBe(false);
    });
});
