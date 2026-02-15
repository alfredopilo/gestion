/**
 * Pruebas API de cursos.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// @ts-ignore
import app from '../../backend/src/app.js';

const BASE = '/api/v1';

describe('Courses API', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ numeroIdentificacion: '123456', password: 'admin123' });
    token = res.body.token;
  });

  it('GET /courses sin token → 401', async () => {
    await request(app).get(`${BASE}/courses`).expect(401);
  });

  it('GET /courses con token devuelve lista', async () => {
    const res = await request(app)
      .get(`${BASE}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body) || res.body.data !== undefined).toBeTruthy();
  });
});
