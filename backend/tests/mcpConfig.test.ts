import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getMcpConfig } from '../src/config/mcpConfig';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

test('getMcpConfig uses MCP_SERVERS_JSON and allowlist', () => {
  process.env.MCP_SERVERS_JSON = JSON.stringify([
    {
      id: 'local-files',
      name: 'Local Files',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server-files'],
    },
  ]);
  process.env.MCP_ALLOWLIST = 'local-files';

  const config = getMcpConfig();

  assert.equal(config.servers.length, 1);
  assert.equal(config.servers[0].id, 'local-files');
  assert.deepEqual(config.allowlist, ['local-files']);
});

test('getMcpConfig falls back to supermemory defaults', () => {
  delete process.env.MCP_SERVERS_JSON;
  delete process.env.MCP_ALLOWLIST;
  process.env.MCP_SUPERMEMORY_API_KEY = 'test-key';

  const config = getMcpConfig();
  const server = config.servers.find((item) => item.id === 'supermemory');

  assert.ok(server);
  assert.equal(config.defaultMemoryServerId, 'supermemory');
});
