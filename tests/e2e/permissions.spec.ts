/**
 * E2E: permisos por rol.
 * ESTUDIANTE no ve pantallas admin; PROFESOR no CRUD usuarios; etc.
 */
import { test, expect } from '@playwright/test';

test.describe('Permisos por rol', () => {
  test('ESTUDIANTE no puede ver /users (redirect o 403)', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-cedula').fill('345678');
    await page.getByTestId('login-password').fill('estudiante123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/users');
    await expect(page).toHaveURL(/\/(login|dashboard|users)/, { timeout: 5000 });
    const url = page.url();
    const body = await page.locator('body').textContent();
    const hasNoAccess = url.includes('/login') || url.includes('/dashboard') || /no tienes permiso|acceso denegado|403/i.test(body || '');
    expect(hasNoAccess).toBeTruthy();
  });

  test('PROFESOR no debe ver enlace o acceso a gestión de usuarios', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-cedula').fill('234567');
    await page.getByTestId('login-password').fill('profesor123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/users');
    await expect(page).toHaveURL(/\/(login|dashboard|users)/, { timeout: 5000 });
    const url = page.url();
    const hasNoAccess = url.includes('/login') || url.includes('/dashboard');
    expect(hasNoAccess).toBeTruthy();
  });

  test('ADMIN puede acceder a /users', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-cedula').fill('123456');
    await page.getByTestId('login-password').fill('admin123');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/users');
    await expect(page).toHaveURL(/\/users/);
    await expect(page.locator('body')).toContainText(/usuario|user|listado/i, { timeout: 8000 });
  });
});
