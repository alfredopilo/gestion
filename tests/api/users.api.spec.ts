/**
 * Pruebas API de usuarios.
 * GET /users, GET /users/:id, POST, PUT, DELETE con permisos (ADMIN).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// @ts-ignore
import app from '../../backend/src/app.js';

const BASE = '/api/v1';

describe('Users API', () => {
  let adminToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ numeroIdentificacion: '123456', password: 'admin123' });
    adminToken = res.body.token;
  });

  it('GET /users sin token → 401', async () => {
    await request(app).get(`${BASE}/users`).expect(401);
  });

  it('GET /users con token ADMIN devuelve lista', async () => {
    const res = await request(app)
      .get(`${BASE}/users`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body) || res.body.data !== undefined).toBeTruthy();
  });

  it('GET /users con token ESTUDIANTE → 403', async () => {
    const login = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ numeroIdentificacion: '345678', password: 'estudiante123' });
    await request(app)
      .get(`${BASE}/users`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(403);
  });
});
