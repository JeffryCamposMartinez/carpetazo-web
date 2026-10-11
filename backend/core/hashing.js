// Huellas (hash) de conexión y correo: nunca se guarda la IP ni el correo en claro.
import crypto from 'crypto';

// Clave de los hashes y firmas (IP, correo, enlaces de baja). Es obligatoria: el servidor no arranca sin ella (ver server.js),
// porque una clave por defecto escrita en el código sería pública y permitiría falsificar firmas.
export const hashSecret = () => {
  const secret = process.env.IP_HASH_SALT;
  if (!secret) throw new Error('Falta IP_HASH_SALT');
  return secret;
};

// Identificador anónimo de la conexión (hash con sal; no se guarda la IP)
export const hashIp = (ip) => crypto.createHash('sha256').update(`${hashSecret()}|${ip || ''}`).digest('hex').slice(0, 32);
export const hashConnection = (req) => hashIp(req.ip);
// Huella del correo (HMAC con la sal del servidor): permite comprobar después si un correo aceptó, sin guardarlo en claro
export const hashEmail = (email) => crypto.createHmac('sha256', hashSecret()).update(String(email).trim().toLowerCase()).digest('hex');
