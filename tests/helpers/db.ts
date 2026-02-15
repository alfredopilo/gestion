/**
 * Harness para reset y seed de BD en tests.
 * Ejecuta seed.test.js del backend (requiere DATABASE_URL).
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../../backend');

export function runSeedTest(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      ['prisma/seed.test.js'],
      {
        cwd: backendDir,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'test' },
      }
    );
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`seed.test.js exited ${code}`))));
    child.on('error', reject);
  });
}
