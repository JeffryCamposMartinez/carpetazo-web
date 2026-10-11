// Variables de entorno: server.js lo importa primero, antes que cualquier módulo que lea process.env al cargarse.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendDir, '.env') });
dotenv.config();
// Desarrollo local: EXTRA_ENV_FILE apunta a otro archivo de variables (por ejemplo, credenciales de servicios externos)
if (process.env.EXTRA_ENV_FILE) dotenv.config({ path: process.env.EXTRA_ENV_FILE });

// Sin clave de hashes y firmas no se arranca: con una clave por defecto (escrita en el código) se podrían falsificar enlaces firmados
if (!process.env.IP_HASH_SALT) {
  console.error('Falta la variable IP_HASH_SALT: defínela en el entorno del servidor antes de iniciar.');
  process.exit(1);
}
