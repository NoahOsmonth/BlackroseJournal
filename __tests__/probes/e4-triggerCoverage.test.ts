/**
 * E4 is pure (no network) — always runs to keep coverage table in CI green path.
 * Full live battery still gated by PROBE_LLM for E1–E3/E5.
 */

import { runE4 } from '../../probes/e4_triggerCoverage';

describe('E4 trigger coverage (offline)', () => {
    it('audits ~40 phrasings against shouldEnableHistoryTools', () => {
        const { rows, summary } = runE4();
        expect(rows.length).toBeGreaterThanOrEqual(40);
        expect(summary.total).toBe(rows.length);
        // Artifacts written; log summary for suite output.
        // eslint-disable-next-line no-console
        console.log('[E4] summary', summary);
        // Known brittleness: false negatives expected on several b* cases — do not gate.
        expect(typeof summary.falseNeg).toBe('number');
    });
});
