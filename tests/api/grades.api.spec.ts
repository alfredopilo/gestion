/**
 * Pruebas API de calificaciones.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// @ts-ignore
import app from '../../backend/src/app.js';

const BASE = '/api/v1';

describe('Grades API', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ numeroIdentificacion: '234567', password: 'profesor123' });
    token = res.body.token;
  });

  it('GET /grades sin token → 401', async () => {
    await request(app).get(`${BASE}/grades`).expect(401);
  });

  it('GET /grades con token PROFESOR devuelve datos', async () => {
    const res = await request(app)
      .get(`${BASE}/grades`)
      .set('Authorization', `Bearer ${token}`);
    expect([200]).toContain(res.status);
  });
});
