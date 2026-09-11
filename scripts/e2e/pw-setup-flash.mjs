// Force merge/deepseek/deepseek-v4-flash-0731 + open chat (Playwriter CLI -f)
await state.page.goto('http://localhost:8081/chat', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 4000));
await state.page.evaluate(() => {
  localStorage.setItem('@blackrose_custom_ai_provider', JSON.stringify({
    enabled: true,
    selectedModelId: 'merge/deepseek/deepseek-v4-flash-0731',
    freeOnly: false,
    baseUrl: 'http://100.107.7.52:20128/v1',
  }));
});
await state.page.reload({ waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 7000));
// dismiss ownership gate if present
try {
  const yes = state.page.getByRole('button', { name: /Yes, this data is mine/i });
  if (await yes.isVisible({ timeout: 1500 })) {
    await yes.click();
    await new Promise((r) => setTimeout(r, 2000));
  }
} catch { /* none */ }
console.log('URL', state.page.url());
console.log(await snapshot({ page: state.page, search: /Type your thoughts|glm|flash|merge|dots|Keep your journal/i, showDiffSinceLastCall: false }));
console.log(await getLatestLogs({ page: state.page, sinceLastCall: true, count: 15 }));
