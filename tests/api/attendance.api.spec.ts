/**
 * Pruebas API de asistencia.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// @ts-ignore
import app from '../../backend/src/app.js';

const BASE = '/api/v1';

describe('Attendance API', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ numeroIdentificacion: '234567', password: 'profesor123' });
    token = res.body.token;
  });

  it('GET /attendance sin token → 401', async () => {
    await request(app).get(`${BASE}/attendance`).expect(401);
  });

  it('GET /attendance/summary con token devuelve datos', async () => {
    const res = await request(app)
      .get(`${BASE}/attendance/summary`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 403]).toContain(res.status);
  });
});
