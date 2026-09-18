/**
 * R0 harness guards + the live baseline run.
 *
 * Offline part (always runs): the seeded ledger really carries the planted
 * token, the gate short-circuits greetings, and all six metrics are produced.
 * Live part (PROBE_LLM=1): one real tool-enabled turn per live probe, with the
 * grounding + whole-turn-latency numbers written to
 * probes/artifacts/r0-recall-baseline.json.
 *
 *   PROBE_LLM=1 npx jest --runInBand __tests__/probes/recallMetrics.test.ts --forceExit
 */
import fs from 'fs';
import path from 'path';

import { runR0RecallMetrics, type R0Baseline } from '../../probes/r0_recallMetrics';
import { buildRecallLedgerFiles, RECALL_NEEDLE_TOKEN } from '../../probes/shared/recallLedger';
import { probesEnabled } from '../../probes/shared/loadEnv';

const ARTIFACT = path.join(process.cwd(), 'probes', 'artifacts', 'r0-recall-baseline.json');

describe('R0 recall metrics ledger (offline guards)', () => {
    jest.setTimeout(120_000);

    it('seeds needles whose bodies really carry the planted token', () => {
        const files = buildRecallLedgerFiles();
        const needle = files.filter((file) => file.role === 'needle');
        expect(needle).toHaveLength(1);
        // Sabotage target: remove the token from the needle body and the
        // hit-rate/grounding probes below go to zero.
        expect(needle[0]!.body).toContain(RECALL_NEEDLE_TOKEN);

        const distractors = files.filter((file) => file.role === 'distractor');
        expect(distractors.length).toBeGreaterThanOrEqual(10);
        for (const distractor of distractors) {
            expect(distractor.body).not.toContain(RECALL_NEEDLE_TOKEN);
            expect(distractor.projectId).toBe(needle[0]!.projectId);
        }
    });

    it('measures all six metrics offline and keeps the gate closed on greetings', async () => {
        const baseline: R0Baseline = await runR0RecallMetrics({ live: false, writeArtifacts: false });

        expect(baseline.live).toBe(false);
        expect(baseline.ledger.needleIds).toHaveLength(1);
        expect(baseline.ledger.formalThreadIds).toContain('fountain_pens');

        const keys = Object.keys(baseline.metrics);
        expect(keys).toEqual(expect.arrayContaining([
            'hitRate',
            'precision',
            'grounding',
            'promptBytes',
            'retrievalLatencyMs',
            'turnLatencyMs',
        ]));

        for (const row of baseline.rows) {
            console.log(
                `[R0 offline ${row.probeId}] route=${row.route} expected=${row.routeExpected} selected=${row.selectedFileIds.length} hit=${row.hit} distractors=${row.selectedDistractors} bytes=${row.promptBytes} retrieval=${row.retrievalMs}ms`,
            );
        }
        console.log('[R0 offline metrics]', JSON.stringify(baseline.metrics, null, 2));

        const greeting = baseline.rows.find((row) => row.probeId === 'gate-smalltalk');
        expect(greeting?.route).toBe('none');
        expect(greeting?.contextChars).toBe(0);

        // Latency sampling must be real wall-clock, never fabricated zeros.
        expect(baseline.metrics.retrievalLatencyMs.samples.length).toBe(baseline.rows.length);
        expect(baseline.metrics.retrievalLatencyMs.medianMs).toBeGreaterThanOrEqual(0);
        expect(baseline.metrics.retrievalLatencyMs.maxMs).toBeGreaterThan(0);
        expect(baseline.metrics.hitRate.probes).toBeGreaterThan(0);
        expect(baseline.metrics.grounding.skipped).toBe(true);
        expect(baseline.metrics.turnLatencyMs).toBeNull();
    });

    it('never rewrites the live artifact from an offline run', async () => {
        const before = fs.existsSync(ARTIFACT) ? fs.statSync(ARTIFACT).mtimeMs : null;
        await runR0RecallMetrics({ live: false, writeArtifacts: false });
        await runR0RecallMetrics({ live: false });
        const after = fs.existsSync(ARTIFACT) ? fs.statSync(ARTIFACT).mtimeMs : null;
        // Offline runs must not clobber a live baseline with ungrounded numbers.
        expect(after).toBe(before);
    });
});

const describeLive = probesEnabled() ? describe : describe.skip;
describeLive('R0 recall metrics (live, PROBE_LLM=1)', () => {
    jest.setTimeout(900_000);

    it('runs the live probes and writes the baseline artifact', async () => {
        const baseline = await runR0RecallMetrics({ live: true, writeArtifacts: true });

        console.log('[R0 metrics]', JSON.stringify(baseline.metrics, null, 2));
        for (const row of baseline.rows) {
            console.log(`[R0 ${row.probeId}] route=${row.route} expected=${row.routeExpected} selected=${row.selectedFileIds.length} hit=${row.hit} bytes=${row.promptBytes} retrieval=${row.retrievalMs}ms`);
            if (row.live) {
                console.log(`[R0 ${row.probeId} live] grounded=${row.live.grounded} tools=${row.live.toolNames.join('+') || 'none'} ctxHasFacts=${row.contextHasFacts} turnMs=${row.live.turnMs}`);
                console.log(`[R0 ${row.probeId} reply] ${row.live.reply}`);
            }
        }

        expect(fs.existsSync(ARTIFACT)).toBe(true);
        expect(baseline.live).toBe(true);
        expect(baseline.metrics.grounding.probes).toBeGreaterThan(0);
        expect(baseline.metrics.turnLatencyMs?.turns).toBeGreaterThan(0);
        // The harness must be measuring a real turn, not a stub.
        expect(baseline.metrics.turnLatencyMs?.medianMs ?? 0).toBeGreaterThan(100);
    });
});
