import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('backend test runner', () => {
  it('fails when an explicit pattern matches no files', () => {
    const backendRoot = path.resolve(__dirname, '../..');
    const result = spawnSync(
      process.execPath,
      ['scripts/run-tests.js', '--testPathPattern=definitely-not-a-real-test'],
      { cwd: backendRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /No test files matched pattern/);
  });
});
