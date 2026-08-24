/**
 * Live LLM design probe battery (E1–E3, E5). Skipped unless PROBE_LLM=1.
 *
 *   set PROBE_LLM=1
 *   npx jest --runInBand __tests__/probes/liveBattery.test.ts --forceExit
 *
 * Uses EXPO_PUBLIC_NANO_GPT_* from .env (same as app). Never hardcodes keys.
 */

import fs from 'fs';
import path from 'path';

import { formatRosterArtifact } from '../../probes/shared/roster';
import { writeArtifact } from '../../probes/shared/artifacts';
import { applyProbeEnv, probesEnabled } from '../../probes/shared/loadEnv';
import { runE1 } from '../../probes/e1_toolSchemaTax';
import { runE2 } from '../../probes/e2_behavioralTools';
import { runE4 } from '../../probes/e4_triggerCoverage';

const describeMaybe = probesEnabled() ? describe : describe.skip;

describeMaybe('PR8-probe live LLM battery (PROBE_LLM=1)', () => {
    jest.setTimeout(3_600_000); // embeddings + multi-model tool loops

    beforeAll(() => {
        applyProbeEnv();
        writeArtifact('roster.json', formatRosterArtifact());
    });

    it('prints roster artifact path', () => {
        const p = path.join(process.cwd(), 'probes', 'artifacts', 'roster.json');
        expect(fs.existsSync(p)).toBe(true);
        // eslint-disable-next-line no-console
        console.log('[ROSTER]\n', fs.readFileSync(p, 'utf-8'));
    });

    it('E1 tool-schema tax — 6 usage JSONs', async () => {
        const { results } = await runE1();
        expect(results.length).toBe(3);
        // eslint-disable-next-line no-console
        console.log('[E1]', JSON.stringify(results, null, 2));
        for (const r of results) {
            // eslint-disable-next-line no-console
            console.log(
                `[E1 usage] ${r.model} without=`,
                JSON.stringify(r.withoutTools.usage),
                'with=',
                JSON.stringify(r.withTools.usage),
                'delta=',
                r.deltaPromptTokens,
            );
        }
    });

    it('E2 behavioral tool harness', async () => {
        const { matrix, flashTranscripts, bestTranscripts } = await runE2();
        expect(matrix.length).toBeGreaterThanOrEqual(2);
        // eslint-disable-next-line no-console
        console.log('[E2 MATRIX]\n', JSON.stringify(matrix, null, 2));
        // eslint-disable-next-line no-console
        console.log('[E2 FLASH TRANSCRIPTS]\n', flashTranscripts);
        // eslint-disable-next-line no-console
        console.log('[E2 BEST TRANSCRIPTS]\n', bestTranscripts);
    });

    it('E4 re-run for live battery artifact bundle', () => {
        const { summary } = runE4();
        // eslint-disable-next-line no-console
        console.log('[E4]', summary);
    });
});
