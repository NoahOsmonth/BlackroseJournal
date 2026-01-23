import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecallArgs, buildSaveMemoryArgs, formatRecallContext } from '../src/agent/memoryTools';
import { McpTool } from '../src/mcp/types';

const saveTool: McpTool = {
  name: 'memory',
  inputSchema: {
    properties: {
      content: { type: 'string' },
      containerTag: { type: 'string' },
      metadata: { type: 'object' },
    },
  },
};

const recallTool: McpTool = {
  name: 'recall',
  inputSchema: {
    properties: {
      query: { type: 'string' },
      containerTag: { type: 'string' },
      includeProfile: { type: 'boolean' },
    },
  },
};

test('buildSaveMemoryArgs maps content + containerTag + metadata', () => {
  const args = buildSaveMemoryArgs({
    tool: saveTool,
    content: 'Remember this',
    containerTag: 'user_1',
    metadata: { source: 'chat' },
  });

  assert.equal(args.content, 'Remember this');
  assert.equal(args.containerTag, 'user_1');
  assert.deepEqual(args.metadata, { source: 'chat' });
});

test('buildRecallArgs maps query + containerTag', () => {
  const args = buildRecallArgs({
    tool: recallTool,
    query: 'What is my goal?',
    containerTag: 'user_1',
    includeProfile: true,
  });

  assert.equal(args.query, 'What is my goal?');
  assert.equal(args.containerTag, 'user_1');
  assert.equal(args.includeProfile, true);
});

test('formatRecallContext formats supermemory-style payload', () => {
  const payload = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          profile: { static: ['Likes tea'], dynamic: [] },
          results: [{ memory: 'Prefers evenings' }],
        }),
      },
    ],
  };

  const formatted = formatRecallContext(payload);
  assert.ok(formatted.includes('User Memory Context'));
  assert.ok(formatted.includes('Likes tea'));
  assert.ok(formatted.includes('Prefers evenings'));
});
