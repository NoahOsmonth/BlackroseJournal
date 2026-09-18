/**
 * R1 pricing: the same probes, measured before and after Dream promotion.
 * Offline and deterministic (no PROBE_LLM needed).
 */
import { runR0DreamDelta } from '../../probes/r0_dreamDelta';

describe('Dream promotion delta (R1 pricing)', () => {
    jest.setTimeout(180_000);

    it('promotes staged files into formal threads and moves the recall numbers', async () => {
        const delta = await runR0DreamDelta({ llm: false, writeArtifacts: false });

        console.log('[R1 delta]', JSON.stringify({
            stagedFiles: delta.stagedFiles,
            dream: delta.dream,
            hitRate: [delta.before.metrics.hitRate.rate, delta.after.metrics.hitRate.rate],
            precision: [delta.before.metrics.precision.mean, delta.after.metrics.precision.mean],
            bytes: [delta.before.metrics.promptBytes.median, delta.after.metrics.promptBytes.median],
            threads: [delta.before.formalThreadIds.length, delta.after.formalThreadIds.length],
            afterThreads: delta.after.formalThreadIds,
        }));
        for (const row of delta.before.rows) {
            const after = delta.after.rows.find((r) => r.probeId === row.probeId);
            console.log(`[R1 ${row.probeId}] hit ${row.hit} -> ${after?.hit} | selected ${row.selectedFileIds.length} -> ${after?.selectedFileIds.length} | route ${row.route} -> ${after?.route}`);
        }

        // Staging produced a backlog; one Dream run drains up to MAX_DREAM_FILES
        // of it (20), minus exact-body duplicates inside a thread. Every staged
        // file therefore ends up either promoted or still staged.
        expect(delta.before.formalThreadIds).toEqual([]);
        expect(delta.dream?.promoted ?? 0).toBeGreaterThan(0);
        expect((delta.dream?.promoted ?? 0) + (delta.dream?.tmpRemaining ?? 0)).toBe(delta.stagedFiles);
        expect(delta.dream?.tmpRemaining ?? 0).toBeLessThan(delta.stagedFiles);
        expect(delta.after.formalThreadIds.length).toBeGreaterThan(0);

        // R1's whole claim: promotion makes the needle reachable at all.
        expect(delta.before.metrics.hitRate.rate ?? 0)
            .toBeLessThan(delta.after.metrics.hitRate.rate ?? 0);
        expect(delta.after.metrics.precision.mean ?? 0)
            .toBeGreaterThan(delta.before.metrics.precision.mean ?? 0);

        const metrics = [
            delta.before.metrics.hitRate.rate,
            delta.after.metrics.hitRate.rate,
            delta.before.metrics.precision.mean,
            delta.after.metrics.precision.mean,
        ];
        for (const value of metrics) {
            expect(typeof value === 'number' || value === null).toBe(true);
        }

    });

    it('writes the delta artifact when asked', async () => {
        const delta = await runR0DreamDelta({ llm: false, writeArtifacts: true });
        expect(delta.phase).toBe('R1');
        expect(delta.notes.length).toBeGreaterThan(0);
    });
});
