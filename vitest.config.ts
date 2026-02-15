import { defineConfig } from 'vitest/config';

/**
 * Vitest para pruebas API/Integración contra el app Express.
 * Ejecutar con: npm run test:api (requiere DATABASE_URL y seed de test).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/api/**/*.spec.ts', 'tests/api/**/*.api.spec.ts'],
    globals: true,
    testTimeout: 15000,
    hookTimeout: 20000,
    setupFiles: ['tests/setup.ts'],
  },
});
