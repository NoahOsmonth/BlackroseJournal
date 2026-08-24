import {
  parseMemoryClearRequest,
  parseMemoryClearResponse,
  parseMemoryRebuildRequest,
  parseMemoryRebuildResponse,
  parseMemoryRecallRequest,
  parseMemoryRecallResponse,
  parseMemoryReflectRequest,
  parseMemoryReflectResponse,
  parseMemoryRetainRequest,
  parseMemoryRetainResponse,
  parseNormalizedInferenceEvent,
  parseNormalizedInferenceRequest,
  parseRevisionConflict,
  parseUpdateModelPreferenceRequest,
  parseUserAiPreference,
} from '../../packages/ai-control-plane-contracts/src/public';

describe('client network contracts', () => {
  test('validates preference requests and responses', () => {
    const request = { modelId: 'catalog-model-1', expectedRevision: 4 };
    const response = {
      selectedModelId: 'catalog-model-1',
      revision: 5,
      updatedAt: '2026-08-24T01:00:00.000Z',
    };

    expect(parseUpdateModelPreferenceRequest(request)).toEqual(request);
    expect(parseUserAiPreference(response)).toEqual(response);
    expect(() =>
      parseUpdateModelPreferenceRequest({ ...request, providerId: 'private' }),
    ).toThrow('preference.providerId: unexpected field');
  });

  test('validates normalized inference requests', () => {
    const request = {
      purpose: 'chat',
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call-1', name: 'get_clock', arguments: '{"timezone":"Asia/Manila"}' }],
        },
        { role: 'tool', toolCallId: 'call-1', content: '2026-08-24T12:00:00+08:00' },
      ],
      systemInstruction: 'Be helpful.',
      tools: [
        {
          name: 'get_clock',
          description: 'Read the current clock.',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
      toolChoice: 'auto',
      responseFormat: { type: 'json_object' },
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 512,
      stream: true,
    };

    expect(parseNormalizedInferenceRequest(request)).toEqual(request);
    expect(() =>
      parseNormalizedInferenceRequest({ ...request, modelId: 'bypass-route' }),
    ).toThrow('inferenceRequest.modelId: unexpected field');
    expect(() => parseNormalizedInferenceRequest({
      ...request,
      messages: [{
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-1', name: 'get_clock', arguments: '{}', secret: 'nope' }],
      }],
    })).toThrow('inferenceRequest.messages[0].toolCalls[0].secret: unexpected field');
    expect(() => parseNormalizedInferenceRequest({
      ...request,
      messages: [{
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-1', name: 'get_clock', arguments: '{bad-json' }],
      }],
    })).toThrow('inferenceRequest.messages[0].toolCalls[0].arguments');
  });

  test('validates every normalized inference event and error', () => {
    const events = [
      { type: 'text_delta', text: 'Hello' },
      {
        type: 'tool_call_delta',
        index: 0,
        id: 'call-1',
        name: 'get_clock',
        argumentsDelta: '{"',
      },
      { type: 'usage', inputTokens: 12, outputTokens: 4, totalTokens: 16 },
      { type: 'completion', reason: 'stop' },
      {
        type: 'error',
        error: {
          code: 'upstream_timeout',
          message: 'Provider timed out',
          retryable: true,
          status: 504,
        },
      },
    ];

    expect(events.map((event) => parseNormalizedInferenceEvent(event))).toEqual(events);
    expect(() =>
      parseNormalizedInferenceEvent({ type: 'provider_debug', raw: 'secret' }),
    ).toThrow('inferenceEvent.type');
  });

  test('validates all client memory request and response boundaries', () => {
    const retain = {
      documentId: 'journal-1',
      content: 'A completed journal entry',
      createdAt: '2026-08-24T01:00:00.000Z',
      metadata: { source: 'journal', completed: true },
    };
    const recall = { query: 'What mattered?', limit: 8 };
    const reflect = { query: 'What pattern is emerging?', maxResults: 6 };
    const rebuild = {
      items: [
        {
          documentId: 'checkin-1',
          kind: 'check_in',
          content: 'Morning check-in',
          createdAt: '2026-08-24T00:00:00.000Z',
        },
      ],
    };

    expect(parseMemoryRetainRequest(retain)).toEqual(retain);
    expect(parseMemoryRecallRequest(recall)).toEqual(recall);
    expect(parseMemoryReflectRequest(reflect)).toEqual(reflect);
    expect(parseMemoryRebuildRequest(rebuild)).toEqual(rebuild);
    expect(parseMemoryClearRequest({})).toEqual({});

    expect(parseMemoryRetainResponse({ retained: true })).toEqual({ retained: true });
    expect(
      parseMemoryRecallResponse({
        results: [
          {
            documentId: 'journal-1',
            content: 'A completed journal entry',
            score: 0.95,
            metadata: { source: 'journal' },
          },
        ],
      }),
    ).toEqual({
      results: [
        {
          documentId: 'journal-1',
          content: 'A completed journal entry',
          score: 0.95,
          metadata: { source: 'journal' },
        },
      ],
    });
    expect(parseMemoryReflectResponse({ reflection: 'Rest is recurring.' })).toEqual({
      reflection: 'Rest is recurring.',
    });
    expect(parseMemoryRebuildResponse({ accepted: 1 })).toEqual({ accepted: 1 });
    expect(parseMemoryClearResponse({ cleared: true })).toEqual({ cleared: true });
  });

  test.each([
    ['retain', parseMemoryRetainRequest, { content: 'entry', bank: 'rosebud' }],
    ['recall', parseMemoryRecallRequest, { query: 'topic', bankId: 'user-bank' }],
    ['reflect', parseMemoryReflectRequest, { query: 'pattern', bank: 'user-bank' }],
    ['rebuild', parseMemoryRebuildRequest, { items: [], bankId: 'user-bank' }],
    ['clear', parseMemoryClearRequest, { bank: 'user-bank' }],
  ])('rejects bank identifiers in %s requests', (_name, parser, request) => {
    expect(() => parser(request)).toThrow('unexpected field');
  });

  test('rejects nested bank data in memory request metadata', () => {
    expect(() =>
      parseMemoryRetainRequest({
        content: 'entry',
        metadata: { source: 'journal', context: { bankId: 'user-bank' } },
      }),
    ).toThrow('memoryRetainRequest.metadata.context: unexpected field');
  });

  test('rejects secret data in memory response metadata', () => {
    expect(() =>
      parseMemoryRecallResponse({
        results: [
          {
            documentId: 'journal-1',
            content: 'entry',
            score: 0.9,
            metadata: { source: 'journal', apiKey: 'plaintext-secret' },
          },
        ],
      }),
    ).toThrow('memoryRecallResponse.results[0].metadata.apiKey: unexpected field');
  });

  test('validates revision conflicts without accepting secret state', () => {
    const conflict = {
      code: 'revision_conflict',
      message: 'The resource changed.',
      currentRevision: 9,
      currentState: {
        selectedModelId: 'catalog-model-1',
        revision: 9,
        updatedAt: '2026-08-24T01:00:00.000Z',
      },
    };

    expect(parseRevisionConflict(conflict, parseUserAiPreference)).toEqual(conflict);
    expect(() =>
      parseRevisionConflict(
        {
          ...conflict,
          currentState: { ...conflict.currentState, credential: 'secret' },
        },
        parseUserAiPreference,
      ),
    ).toThrow('userAiPreference.credential: unexpected field');
  });
});
