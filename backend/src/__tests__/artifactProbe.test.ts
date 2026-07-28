import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

describe('production artifact probe', () => {
  it('loads the compiled shared contract', () => {
    const backendRoot = path.resolve(__dirname, '../..');
    const result = spawnSync(
      process.execPath,
      ['dist/backend/src/artifactProbe.js'],
      { cwd: backendRoot, encoding: 'utf8' },
    );
    assert.equal(result.status, 0);
    assert.equal(result.stdout, 'artifact-ok\n');
    assert.equal(result.stderr, '');
  });

  it('builds from repository root without copying secrets', () => {
    const backendRoot = path.resolve(__dirname, '../..');
    const root = path.resolve(backendRoot, '..');
    const dockerfile = fs.readFileSync(
      path.join(backendRoot, 'Dockerfile'),
      'utf8',
    );
    const dockerIgnore = fs.readFileSync(
      path.join(backendRoot, 'Dockerfile.dockerignore'),
      'utf8',
    );
    assert.match(dockerfile, /COPY shared\/ \/app\/shared\//);
    assert.match(dockerfile, /COPY backend\/package\.json backend\/package-lock\.json/);
    assert.match(dockerfile, /CMD \["npm", "start"\]/);
    assert.match(dockerIgnore, /backend\/\.env\*/);
    assert.match(dockerIgnore, /backend\/node_modules/);
    assert.equal(fs.existsSync(path.join(root, 'shared/memory/contracts.ts')), true);
  });
});
