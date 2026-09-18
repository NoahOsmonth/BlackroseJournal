/**
 * R2 pricing for supersession, on the separate restatement scenario.
 *
 * The falsifiable claims:
 *   - the stale copy was selected before the pass and is not after it,
 *   - the survivor answers both times,
 *   - the control thread — distinct memories that share vocabulary — keeps both
 *     files, so a pass that over-fired would fail here rather than look better.
 */
import { runR2SupersessionDelta } from '../../probes/r2_supersessionDelta';
import { CONTROL_THREAD_ID, RESTATEMENT_THREAD_ID } from '../../probes/shared/restatementScenario';

describe('R2 supersession pricing (restatement scenario)', () => {
    jest.setTimeout(120_000);

    it('prices the pass: stale copy leaves recall, survivor keeps answering', async () => {
        const delta = await runR2SupersessionDelta({ writeArtifacts: false });

        console.log('[R2S metrics]', JSON.stringify({
            superseded: delta.supersession.superseded,
            threads: delta.supersession.threads,
            staleSelected: [delta.before.staleSelectedCount, delta.after.staleSelectedCount],
            precision: [delta.before.meanPrecision, delta.after.meanPrecision],
            contextChars: [delta.before.contextChars, delta.after.contextChars],
            liveFiles: [delta.before.liveFileCount, delta.after.liveFileCount],
            controlIntact: delta.controlIntact,
        }));
        delta.before.rows.forEach((row) => {
            const after = delta.after.rows.find((r) => r.probeId === row.probeId);
            console.log('[R2S ' + row.probeId + '] thread=' + String(row.resolvedProjectId)
                + ' stale=' + String(row.staleSelected) + '->' + String(after?.staleSelected)
                + ' hit=' + String(row.hit) + '->' + String(after?.hit)
                + ' chars=' + String(row.contextChars) + '->' + String(after?.contextChars));
        });

        expect(delta.seededFiles).toBeGreaterThanOrEqual(8);
        // Exactly one collapse, in exactly one thread: the control pair survives.
        expect(delta.supersession.superseded).toBe(1);
        expect(delta.supersession.threads).toEqual([RESTATEMENT_THREAD_ID]);

        const priced = (phase: typeof delta.before) => phase.rows.find((r) => r.probeId === 'restated-topic');
        const control = (phase: typeof delta.before) => phase.rows.find((r) => r.probeId === 'control-topic');

        // Both probes resolve to the thread they are about.
        expect(priced(delta.before)?.resolvedProjectId).toBe(RESTATEMENT_THREAD_ID);
        expect(control(delta.before)?.resolvedProjectId).toBe(CONTROL_THREAD_ID);

        // The stale copy was genuinely in recall before the pass.
        expect(priced(delta.before)?.staleSelected).toBe(true);
        expect(priced(delta.after)?.staleSelected).toBe(false);

        // The survivor answered before and still answers after.
        expect(priced(delta.before)?.hit).toBe(true);
        expect(priced(delta.after)?.hit).toBe(true);

        // Removing the duplicate halves the thread's share of the recall budget.
        const beforeChars = priced(delta.before)?.contextChars ?? 0;
        const afterChars = priced(delta.after)?.contextChars ?? 0;
        expect(afterChars).toBeLessThan(beforeChars);
        expect(priced(delta.after)?.precision).toBe(1);
        expect(priced(delta.before)?.precision).toBe(0.5);

        // The control thread is untouched, in the store and in recall.
        expect(control(delta.before)?.staleSelected).toBe(false);
        expect(control(delta.after)?.hit).toBe(true);
        expect(delta.controlIntact).toBe(true);
    });

    it('writes an audit pointer instead of deleting the superseded file', async () => {
        const delta = await runR2SupersessionDelta({ writeArtifacts: false });

        expect(delta.audit).not.toBeNull();
        expect(delta.audit?.deprecated).toBe(true);
        expect(delta.audit?.supersededBy).toContain('writing-desk-setup-current');
        expect(delta.audit?.supersededAt).toBeTruthy();
        expect(delta.audit?.reason).toBe('restated by a newer memory in the same thread');

        // Deprecated, not gone: the file is still readable for audit.
        const staleRow = delta.after.rows.find((r) => r.probeId === 'restated-topic');
        expect(staleRow?.expectedId).not.toBe(delta.audit?.id);
    });

    it('is reproducible run to run', async () => {
        const first = await runR2SupersessionDelta({ writeArtifacts: false });
        const second = await runR2SupersessionDelta({ writeArtifacts: false });
        const fingerprint = (d: typeof first) => JSON.stringify({
            superseded: d.supersession,
            before: d.before.rows.map((r) => [r.probeId, r.selectedFileIds, r.contextChars]),
            after: d.after.rows.map((r) => [r.probeId, r.selectedFileIds, r.contextChars]),
        });
        expect(fingerprint(first)).toBe(fingerprint(second));
    });

    it('writes the artifact when asked', async () => {
        const delta = await runR2SupersessionDelta({ writeArtifacts: true });
        expect(delta.supersession.superseded).toBe(1);
    });
});
