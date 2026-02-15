/**
 * Pruebas API de pagos.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
// @ts-ignore
import app from '../../backend/src/app.js';

const BASE = '/api/v1';

describe('Payments API', () => {
  let adminToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post(`${BASE}/auth/login`)
      .send({ numeroIdentificacion: '567890', password: 'secretaria123' });
    adminToken = res.body.token;
  });

  it('GET /payments sin token → 401', async () => {
    await request(app).get(`${BASE}/payments`).expect(401);
  });

  it('GET /payments con token SECRETARIA devuelve datos', async () => {
    const res = await request(app)
      .get(`${BASE}/payments`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      expect(Array.isArray(res.body.data)).toBeTruthy();
    }
  });
});
