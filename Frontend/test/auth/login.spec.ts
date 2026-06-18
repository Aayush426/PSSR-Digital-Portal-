import { test, expect } from '@playwright/test';

const VALID_USER = {
  email: 'admin@nayara.com',
  password: 'password123'
};

const INVALID_USER = {
  email: 'wronguser@gmail.com',
  password: 'WrongPassword123'
};

test.describe('Login Authentication Module', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC_LOGIN_001 - Admin can login with valid credentials', async ({ page }) => {

    await page.getByPlaceholder('Enter your email').fill(VALID_USER.email);

    await page.getByPlaceholder('Enter your password').fill(VALID_USER.password);

    await page.getByRole('button', { name: /login/i }).click();

    await expect(
      page.getByText('Admin Center')
    ).toBeVisible();

  });

  test('TC_LOGIN_002 - Login fails with invalid password', async ({ page }) => {

    await page.getByPlaceholder('Enter your email').fill(VALID_USER.email);

    await page.getByPlaceholder('Enter your password').fill(INVALID_USER.password);

    await page.getByRole('button', { name: /login/i }).click();

    await expect(
      page.getByText(/invalid|incorrect|failed/i)
    ).toBeVisible();

  });

});