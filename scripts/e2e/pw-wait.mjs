for (let i = 0; i < 50; i++) {
  const body = await state.page.locator('body').innerText();
  const thinking = /AI is thinking|AI typing/i.test(body);
  const input = await state.page
    .locator('textarea[placeholder*="Type your thoughts"]')
    .first()
    .isVisible({ timeout: 300 })
    .catch(() => false);
  if (!thinking && input) {
    console.log('READY after', i);
    console.log(body.slice(-1800));
    break;
  }
  await new Promise((r) => setTimeout(r, 3000));
}
console.log(await getLatestLogs({ page: state.page, sinceLastCall: true, count: 40 }));
