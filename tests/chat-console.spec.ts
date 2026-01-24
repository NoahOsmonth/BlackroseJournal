import { test, expect } from '@playwright/test';

test('chat page has no raw text node errors', async ({ page }) => {
  const errors: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  await page.goto('http://localhost:8081/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const goDeeper = page.getByText('Go deeper', { exact: false });
  if (await goDeeper.isVisible().catch(() => false)) {
    await goDeeper.click();
    await page.waitForTimeout(1000);
  }

  const rawTextErrors = errors.filter((message) =>
    message.includes('Unexpected text node') ||
    message.includes('text node cannot be a child of a <View>') ||
    message.includes('Raw text node found inside')
  );

  expect(rawTextErrors).toEqual([]);
});
