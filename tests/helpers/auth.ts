/**
 * Helpers de autenticación para tests.
 * Login por cédula (numeroIdentificacion) contra /api/v1/auth/login.
 */

const BASE = process.env.API_BASE_URL || 'http://localhost:3000';

export const CREDENTIALS = {
  ADMIN: { cedula: '123456', password: 'admin123' },
  PROFESOR: { cedula: '234567', password: 'profesor123' },
  ESTUDIANTE: { cedula: '345678', password: 'estudiante123' },
  REPRESENTANTE: { cedula: '456789', password: 'representante123' },
  SECRETARIA: { cedula: '567890', password: 'secretaria123' },
} as const;

export type Role = keyof typeof CREDENTIALS;

/**
 * Obtiene token JWT para un rol usando cédula y contraseña.
 */
export async function getToken(role: Role): Promise<string> {
  const { cedula, password } = CREDENTIALS[role];
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numeroIdentificacion: cedula, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed ${res.status}: ${body}`);
  }
  const data = await res.json();
  if (!data.token) throw new Error('No token in login response');
  return data.token;
}

/**
 * Headers Authorization Bearer para un rol.
 */
export async function authHeaders(role: Role): Promise<Record<string, string>> {
  const token = await getToken(role);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
