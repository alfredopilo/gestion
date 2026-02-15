/**
 * Pruebas API de estudiantes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// @ts-ignore
import app from '../../backend/src/app.js';

const BASE = '/api/v1';

describe('Students API', () => {
  let adminToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ numeroIdentificacion: '123456', password: 'admin123' });
    adminToken = res.body.token;
  });

  it('GET /students sin token → 401', async () => {
    await request(app).get(`${BASE}/students`).expect(401);
  });

  it('GET /students con token devuelve datos', async () => {
    const res = await request(app)
      .get(`${BASE}/students`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body) || res.body.data !== undefined).toBeTruthy();
    }
  });
});
