/**
 * R2 pricing on the fixed R0 ledger (offline, deterministic).
 *
 * The falsifiable claim lives in the second test: over ONE promoted manifest,
 * the pre-R2 selection rule picks five distractors and never the needle, while
 * the faded rule puts the needle first. Same store, same query — so the
 * difference cannot be run-to-run promotion jitter.
 */
import { runR2RecallDelta } from '../../probes/r2_recallDelta';

describe('R2 supersession + fading (R0 ledger pricing)', () => {
    jest.setTimeout(300_000);

    it('keeps R1\'s promotion gains and turns the recorded topical miss into a hit', async () => {
        const delta = await runR2RecallDelta({ llm: false, writeArtifacts: false });

        console.log('[R2 metrics]', JSON.stringify({
            hitRate: [delta.before.metrics.hitRate.rate, delta.after.metrics.hitRate.rate],
            precision: [delta.before.metrics.precision.mean, delta.after.metrics.precision.mean],
            threads: [delta.before.formalThreadIds.length, delta.after.formalThreadIds.length],
            superseded: delta.supersession.superseded,
            reproducible: delta.afterReproducible,
        }));
        delta.after.rows.forEach((row) => {
            console.log('[R2 ' + row.probeId + '] hit=' + String(row.hit)
                + ' selected=' + row.selectedFileIds.length
                + ' distractors=' + row.selectedDistractors
                + ' route=' + row.route);
        });

        expect(delta.before.formalThreadIds).toEqual([]);
        expect(delta.after.formalThreadIds.length).toBeGreaterThan(0);

        // R1 recorded hit-rate 66.7% / precision 0.400 after one promotion pass.
        expect(delta.after.metrics.hitRate.hits).toBeGreaterThanOrEqual(4);
        expect(delta.after.metrics.hitRate.probes).toBe(6);
        expect(delta.after.metrics.precision.mean ?? 0).toBeGreaterThan(0.4);

        // The R0 baseline's headline miss, now a hit.
        const topical = delta.after.rows.find((row) => row.probeId === 'precision-topical');
        expect(topical?.hit).toBe(true);
    });

    it('prices fading as a same-store A/B against the pre-R2 rule', async () => {
        const delta = await runR2RecallDelta({ llm: false, writeArtifacts: false });
        const topical = delta.selection.find((row) => row.probeId === 'precision-topical');

        expect(topical?.threadId).toBe('fountain-pens');
        // Falsifiable: the old rule selected five distractors and missed the needle.
        expect(topical?.legacyHit).toBe(false);
        expect(topical?.legacyRank).toBeNull();
        // Faded rule: the needle is the first thing selected.
        expect(topical?.fadedHit).toBe(true);
        expect(topical?.fadedRank).toBe(0);

        // Supersession refuses to fire on this ledger — its distractors are
        // distinct entries with templated headers, not restatements.
        expect(delta.supersession.superseded).toBe(0);
    });

    it('is reproducible on a fixed store', async () => {
        const delta = await runR2RecallDelta({ llm: false, writeArtifacts: false });
        expect(delta.afterReproducible).toBe(true);
    });

    it('writes the delta artifact when asked', async () => {
        const delta = await runR2RecallDelta({ llm: false, writeArtifacts: true });
        expect(delta.phase).toBe('R2');
        expect(delta.notes.length).toBeGreaterThan(0);
        expect(delta.selection.length).toBeGreaterThan(0);
    });
});
