import { test, expect } from "@playwright/test";

test('has title', async ({ page }) => {
  await page.goto('https://adalgarcia.com');

  await expect(page).toHaveTitle(/Playwright/);
})
