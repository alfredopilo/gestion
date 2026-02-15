# Suite de pruebas - Gestión Escolar

## Estructura

- **`e2e/`** – Playwright (TypeScript): flujos UI por rol, auth, permisos.
- **`api/`** – Vitest + Supertest (TypeScript): endpoints REST (auth, users, students, courses, grades, attendance, payments).
- **`helpers/`** – Auth (login por cédula), DB (seed).
- **`fixtures/`** – Datos para bulk (grades, attendance).
- **`setup.ts`** – Carga `backend/.env` para tests API.

## Credenciales de prueba (seed determinístico)

| Rol           | Cédula  | Contraseña      |
|---------------|---------|-----------------|
| ADMIN         | 123456  | admin123        |
| PROFESOR      | 234567  | profesor123     |
| ESTUDIANTE    | 345678  | estudiante123   |
| REPRESENTANTE | 456789  | representante123|
| SECRETARIA    | 567890  | secretaria123   |

## Requisitos

- Node 20+
- PostgreSQL para tests (local o Docker).
- Variables: `DATABASE_URL` (y opcionalmente `backend/.env`).

## Comandos (desde la raíz del proyecto)

```bash
# 1. Seed de BD para tests (obligatorio antes de API/E2E)
npm run test:db:seed

# 2. Pruebas API (Vitest + Supertest)
npm run test:api

# 3. Pruebas E2E (Playwright). Backend y frontend deben estar levantados.
# Ej.: backend en :3000, frontend en :5173
npm run test:e2e

# 4. Todas
npm run test:all
```

## data-testid en UI

- **Login:** `login-cedula`, `login-password`, `login-submit`
- **Layout:** `logout-btn`

## CI (GitHub Actions)

- Workflow: `.github/workflows/test.yml`
- Postgres service, `prisma migrate deploy`, `prisma/seed.test.js`, luego `test:api` y `test:e2e`.
- En fallo E2E se sube el artifact `playwright-report`.
