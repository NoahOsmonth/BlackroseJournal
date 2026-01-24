import { test, expect } from '@playwright/test';

test('insights page has no raw text node errors', async ({ page }) => {
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

  await page.goto('http://localhost:8081/insights', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const rawTextErrors = errors.filter((message) =>
    message.includes('Unexpected text node') ||
    message.includes('text node cannot be a child of a <View>')
  );

  expect(rawTextErrors).toEqual([]);
});
