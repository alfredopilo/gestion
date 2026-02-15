/**
 * Pruebas API de autenticación.
 * Requieren BD con seed de test (npm run test:db:seed) y DATABASE_URL.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// @ts-ignore - app ESM desde backend
import app from '../../backend/src/app.js';

const BASE = '/api/v1';

describe('Auth API', () => {
  describe('POST /auth/login', () => {
    it('acepta login con cédula y contraseña y devuelve JWT', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ numeroIdentificacion: '123456', password: 'admin123' })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.rol).toBe('ADMIN');
      expect(typeof res.body.token).toBe('string');
    });

    it('login con cada rol por cédula devuelve token', async () => {
      const roles = [
        { cedula: '234567', password: 'profesor123', rol: 'PROFESOR' },
        { cedula: '345678', password: 'estudiante123', rol: 'ESTUDIANTE' },
        { cedula: '456789', password: 'representante123', rol: 'REPRESENTANTE' },
        { cedula: '567890', password: 'secretaria123', rol: 'SECRETARIA' },
      ];
      for (const r of roles) {
        const res = await request(app)
          .post(`${BASE}/auth/login`)
          .send({ numeroIdentificacion: r.cedula, password: r.password })
          .expect(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.rol).toBe(r.rol);
      }
    });

    it('rechaza credenciales inválidas con 401', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ numeroIdentificacion: '123456', password: 'wrongpassword' })
        .expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('validación Zod: falta numeroIdentificacion → 400 o 500', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ password: 'admin123' });
      expect([400, 500]).toContain(res.status);
    });

    it('validación Zod: contraseña corta → error', async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ numeroIdentificacion: '123456', password: '123' });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /auth/profile', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ numeroIdentificacion: '123456', password: 'admin123' });
      token = res.body.token;
    });

    it('con JWT válido devuelve perfil', async () => {
      const res = await request(app)
        .get(`${BASE}/auth/profile`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.rol).toBe('ADMIN');
      expect(res.body).toHaveProperty('numeroIdentificacion');
    });

    it('sin token devuelve 401', async () => {
      await request(app)
        .get(`${BASE}/auth/profile`)
        .expect(401);
    });

    it('token inválido devuelve 401', async () => {
      await request(app)
        .get(`${BASE}/auth/profile`)
        .set('Authorization', 'Bearer invalid')
        .expect(401);
    });
  });

  describe('PUT /auth/change-password', () => {
    let token: string;

    beforeAll(async () => {
      const res = await request(app)
        .post(`${BASE}/auth/login`)
        .send({ numeroIdentificacion: '123456', password: 'admin123' });
      token = res.body.token;
    });

    it('acepta contraseña actual y nueva y devuelve mensaje', async () => {
      const res = await request(app)
        .put(`${BASE}/auth/change-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'admin123', newPassword: 'admin123' })
        .expect(200);
      expect(res.body.message).toBeDefined();
    });
  });
});
