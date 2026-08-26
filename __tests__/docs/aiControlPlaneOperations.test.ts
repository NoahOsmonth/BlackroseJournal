import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const operationsDoc = path.join(repoRoot, 'notes/ai-control-plane-operations.md');
const exportScript = path.join(repoRoot, 'scripts/control-plane/export-supabase.sh');
const importScript = path.join(repoRoot, 'scripts/control-plane/import-supabase.sh');

describe('AI control-plane operations assets', () => {
  it('documents every supported deployment and recovery path', () => {
    const content = readFileSync(operationsDoc, 'utf8');

    for (const heading of [
      'Local Supabase development',
      'Hosted Supabase deployment',
      'Production self-hosted deployment',
      'Rollback',
      'Export and import into a clean target',
      'Credential master-key rotation and recovery',
      'Hindsight private loopback deployment',
    ]) {
      expect(content).toContain(`## ${heading}`);
    }
    expect(content).toContain('127.0.0.1:8888');
    expect(content).toContain('external PostgreSQL with pgvector');
    expect(content).toContain('development/staging helper');
    expect(content).toContain('HINDSIGHT_VERSION');
    expect(content).toContain('AI_CREDENTIAL_MASTER_KEY_RING_JSON');
    expect(content).toContain('never contains the key ring');
    expect(content).not.toMatch(/reset\.sh -y|docker compose down -v/);
  });

  it('lists the mobile and server-only gateway configuration without public secrets', () => {
    const rootEnv = readFileSync(path.join(repoRoot, '.env.example'), 'utf8');
    const backendEnv = readFileSync(path.join(repoRoot, 'backend/.env.example'), 'utf8');

    expect(rootEnv).toContain('EXPO_PUBLIC_AGENT_BASE_URL=');
    for (const name of [
      'SUPABASE_JWT_ISSUER',
      'SUPABASE_JWT_AUDIENCE',
      'SUPABASE_JWKS_URL',
      'SUPABASE_CONTROL_REST_URL',
      'SUPABASE_SECRET_KEY',
      'AI_CREDENTIAL_MASTER_KEY_VERSION',
      'AI_CREDENTIAL_MASTER_KEY_BASE64',
      'AI_CREDENTIAL_MASTER_KEY_RING_JSON',
    ]) {
      expect(backendEnv).toContain(`${name}=`);
    }
    expect(`${rootEnv}\n${backendEnv}`).not.toMatch(/EXPO_PUBLIC_(?:SUPABASE_SECRET|SERVICE_ROLE|AI_CREDENTIAL)/);
  });

  it('documents managed inference quotas and the multi-instance limiter boundary', () => {
    const backendEnv = readFileSync(path.join(repoRoot, 'backend/.env.example'), 'utf8');
    const runbook = readFileSync(operationsDoc, 'utf8');

    for (const name of [
      'AI_MANAGED_MAX_CONCURRENT_PER_USER',
      'AI_MANAGED_REQUESTS_PER_WINDOW',
      'AI_MANAGED_TOKENS_PER_WINDOW',
      'AI_MANAGED_LIMIT_WINDOW_MS',
      'AI_MANAGED_DEFAULT_OUTPUT_RESERVATION',
    ]) {
      expect(backendEnv).toContain(`${name}=`);
    }
    expect(runbook).toMatch(/single gateway process/i);
    expect(runbook).toMatch(/distributed,\s+atomic limiter/i);
  });

  it('exports a new protected bundle without mutating the source database', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'blackrose-export-test-'));
    const bin = path.join(temp, 'bin');
    const output = path.join(temp, 'bundle');
    execFileSync('mkdir', ['-p', bin]);
    const fakeSupabase = path.join(bin, 'supabase');
    writeFileSync(fakeSupabase, `#!/bin/sh\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = "-f" ] || [ "$1" = "--file" ]; then shift; printf 'fixture\\n' > "$1"; fi\n  shift\ndone\n`);
    execFileSync('chmod', ['+x', fakeSupabase]);

    execFileSync('bash', [exportScript, output], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SOURCE_DB_URL: 'postgresql://source.invalid/db' },
    });

    expect(readFileSync(path.join(output, 'manifest.txt'), 'utf8')).toContain('schema.sql');
    expect((Number.parseInt(execFileSync('stat', ['-c', '%a', output], { encoding: 'utf8' }).trim(), 10))).toBe(700);
    expect(readFileSync(exportScript, 'utf8')).not.toMatch(/drop database|truncate|reset\.sh|down -v/i);
  });

  it('keeps imports dry-run by default and requires an explicit clean-target execution', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'blackrose-import-test-'));
    for (const name of ['roles.sql', 'schema.sql', 'data.sql']) {
      writeFileSync(path.join(temp, name), '-- fixture\n');
    }
    const result = spawnSync('bash', [importScript, temp], {
      encoding: 'utf8',
      env: { ...process.env, TARGET_DB_URL: 'postgresql://target.invalid/db' },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DRY RUN');
    expect(result.stdout).toContain('--execute');
    expect(readFileSync(importScript, 'utf8')).toContain("to_regclass('public.ai_catalog_models')");
    expect(readFileSync(importScript, 'utf8')).toContain('--single-transaction');
    expect(readFileSync(importScript, 'utf8')).not.toMatch(/--force|drop database|truncate|reset\.sh|down -v/i);
  });
});
