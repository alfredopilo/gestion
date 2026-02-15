/**
 * E2E: flujos de autenticación (login por cédula, logout, mensaje de error).
 * Usa data-testid: login-cedula, login-password, login-submit.
 */
import { test, expect } from '@playwright/test';

test.describe('Auth E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-cedula')).toBeVisible();
  });

  test('login válido con cédula ADMIN redirige al dashboard', async ({ page }) => {
    await page.getByTestId('login-cedula').fill('123456');
    await page.getByTestId('login-password').fill('admin123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard|inicio|bienvenido/i })).toBeVisible({ timeout: 10000 });
  });

  test('login válido PROFESOR redirige al dashboard', async ({ page }) => {
    await page.getByTestId('login-cedula').fill('234567');
    await page.getByTestId('login-password').fill('profesor123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login válido ESTUDIANTE redirige al dashboard', async ({ page }) => {
    await page.getByTestId('login-cedula').fill('345678');
    await page.getByTestId('login-password').fill('estudiante123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('login inválido muestra mensaje de error', async ({ page }) => {
    await page.getByTestId('login-cedula').fill('123456');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    await expect(page.getByRole('status')).toHaveText(/inválidas|error|incorrecta/i, { timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout vuelve a login y limpia sesión', async ({ page }) => {
    await page.getByTestId('login-cedula').fill('123456');
    await page.getByTestId('login-password').fill('admin123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByTestId('logout-btn').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId('login-cedula')).toBeVisible();
  });
});
