// Attach OmniRoute network logger for multi-tool observation.
if (!state.netHooked) {
  state.netHooked = true;
  state.toolLog = state.toolLog || [];
  state.page.on('console', (msg) => {
    const t = msg.text();
    if (/agent-loop|agent_tool|stream_agent_result|agent_duplicate|agent_max_rounds|toolsRepaired|toolCallSource|agent-default|glm|dots/i.test(t)) {
      state.toolLog.push(t.slice(0, 400));
      console.log('[console]', t.slice(0, 350));
    }
  });
  state.page.on('request', (req) => {
    const url = req.url();
    if (!/20128|chat\/completions|100\.107\.7\.52/i.test(url)) return;
    try {
      const post = req.postData();
      const parsed = post ? JSON.parse(post) : null;
      const tools = parsed?.tools?.map((t) => t.function?.name || t.name).filter(Boolean) || [];
      console.log('[req]', parsed?.model ?? '?', 'tools=', JSON.stringify(tools), 'msgs=', parsed?.messages?.length ?? 0);
      state.toolLog.push(`REQ ${parsed?.model} ${JSON.stringify(tools)}`);
    } catch { /* ignore */ }
  });
  state.page.on('response', async (res) => {
    const url = res.url();
    if (!/20128|chat\/completions|100\.107\.7\.52/i.test(url)) return;
    try {
      const text = await res.text();
      const names = [];
      for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const msg = json.choices?.[0]?.message || json.choices?.[0]?.delta || {};
          if (Array.isArray(msg.tool_calls)) {
            for (const tc of msg.tool_calls) {
              const name = tc.function?.name || tc.name;
              if (name) names.push(name);
            }
          }
        } catch { /* partial */ }
      }
      console.log('[res]', res.status(), 'tools=', JSON.stringify(names));
      if (names.length) state.toolLog.push(`RES ${res.status()} ${JSON.stringify(names)}`);
    } catch { /* ignore */ }
  });
}
console.log('network hook ready');
