// Huellas (hash) de conexión y correo: nunca se guarda la IP ni el correo en claro.
import crypto from 'crypto';

// Identificador anónimo de la conexión (hash con sal; no se guarda la IP). Define IP_HASH_SALT en el servidor para que no sea reversible.
export const hashIp = (ip) => crypto.createHash('sha256').update(`${process.env.IP_HASH_SALT || 'carpetazo'}|${ip || ''}`).digest('hex').slice(0, 32);
export const hashConnection = (req) => hashIp(req.ip);
// Huella del correo (HMAC con la sal del servidor): permite comprobar después si un correo aceptó, sin guardarlo en claro
export const hashEmail = (email) => crypto.createHmac('sha256', process.env.IP_HASH_SALT || 'carpetazo').update(String(email).trim().toLowerCase()).digest('hex');
