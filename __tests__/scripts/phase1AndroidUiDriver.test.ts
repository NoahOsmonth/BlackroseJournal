import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const script = path.resolve(__dirname, '../../scripts/phase1/android-ui-driver.mjs');

describe('android-ui-driver', () => {
    let xmlPath: string;

    beforeEach(() => {
        xmlPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'phase1-ui-')), 'window.xml');
        fs.writeFileSync(xmlPath, '<hierarchy><node text="Finish &amp; save" resource-id="finish" enabled="true" visible-to-user="true" bounds="[10,20][110,220]" /></hierarchy>');
    });

    afterEach(() => fs.rmSync(path.dirname(xmlPath), { force: true, recursive: true }));

    it('parses escaped text and bounds into a current tap center', () => {
        const result = spawnSync(process.execPath, [script, '--xml', xmlPath, '--text', 'Finish & save'], { encoding: 'utf8' });

        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({ x: 60, y: 120 });
    });

    it('rejects duplicate enabled nodes instead of guessing a coordinate', () => {
        fs.writeFileSync(xmlPath, '<hierarchy><node text="Finish" enabled="true" bounds="[0,0][1,1]" /><node text="Finish" enabled="true" bounds="[1,1][2,2]" /></hierarchy>');

        const result = spawnSync(process.execPath, [script, '--xml', xmlPath, '--text', 'Finish'], { encoding: 'utf8' });

        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/exactly one/i);
    });
});
