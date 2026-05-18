import { test, chromium, expect } from '@playwright/test';

test('app loads correctly', async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto('http://localhost:3000');

  await expect(
    page.getByText('Digital PSSR')
  ).toBeVisible();

  await browser.close();
});