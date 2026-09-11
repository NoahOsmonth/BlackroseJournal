if (!state.page || state.page.isClosed()) {
  state.page = context.pages().find((p) => p.url().includes('localhost:8081')) ?? (await context.newPage());
  await state.page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
}
console.log('URL:', state.page.url());
console.log(await getLatestLogs({ page: state.page, sinceLastCall: false, count: 30 }));
console.log(await snapshot({ page: state.page, showDiffSinceLastCall: false }));
