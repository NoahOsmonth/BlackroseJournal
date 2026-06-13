import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleAskRosebud } from '../agent/askRosebudService';
import type { AskRosebudRequest } from '../agent/types';

function makeRequest(overrides: Partial<AskRosebudRequest> = {}): AskRosebudRequest {
  return {
    question: 'How am I doing?',
    timeRange: 'this-week',
    ...overrides,
  };
}

describe('handleAskRosebud', () => {
  it('includes goalsContext in the user message when provided', async () => {
    let capturedMessages: { role: string; content: string }[] = [];
    const deps = {
      createChatCompletion: async (messages: { role: string; content: string }[]) => {
        capturedMessages = messages;
        return { content: 'You are doing well.', reasoning: '' };
      },
    };

    const request = makeRequest({
      goalsContext: "## User's Current Goals and Habits\n\n- Run daily (Goal)",
    });

    const answer = await handleAskRosebud(request, deps);

    assert.equal(answer, 'You are doing well.');
    const userMessage = capturedMessages.find((m) => m.role === 'user');
    assert.ok(userMessage);
    assert.ok(userMessage.content.includes("## User's Current Goals and Habits"));
    assert.ok(userMessage.content.includes('Question: How am I doing?'));
    assert.ok(
      userMessage.content.indexOf('Question: How am I doing?') <
        userMessage.content.indexOf("## User's Current Goals and Habits")
    );
  });

  it('omits goalsContext when not provided', async () => {
    let capturedMessages: { role: string; content: string }[] = [];
    const deps = {
      createChatCompletion: async (messages: { role: string; content: string }[]) => {
        capturedMessages = messages;
        return { content: 'ok', reasoning: '' };
      },
    };

    const request = makeRequest();
    await handleAskRosebud(request, deps);

    const userMessage = capturedMessages.find((m) => m.role === 'user');
    assert.ok(userMessage);
    assert.ok(!userMessage.content.includes("## User's Current Goals and Habits"));
    assert.ok(userMessage.content.includes('Question: How am I doing?'));
  });
});
