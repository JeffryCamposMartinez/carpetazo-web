// Se usa con: node --import ./tests/register.mjs server.js
// Reemplaza Firebase Admin por una simulación SOLO para pruebas: el token "test-<uid>" es válido.
import { register } from 'node:module';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL || '';
if (process.env.TEST_AUTH_STUB !== '1' || !/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error('Simulación de sesión rechazada: requiere TEST_AUTH_STUB=1 y una base de datos local.');
  process.exit(1);
}
register('./auth-stub-loader.mjs', import.meta.url);
