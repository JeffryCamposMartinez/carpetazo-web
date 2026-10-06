// Términos y Condiciones y Política de Privacidad: versiones vigentes y aceptación.
import { getAuth } from 'firebase-admin/auth';
import { prisma } from './db.js';

// Si cambia el texto de alguno, se sube su versión aquí y en frontend/src/legal/versions.js (una prueba las compara).
export const LEGAL_CURRENT = { termsVersion: '2026-10-06.2', privacyVersion: '2026-10-06.2' };
export const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000; // solo una cuenta recién creada puede elegir su usuario al aceptar
export const ACCEPTED_CACHE_MS = 5 * 60 * 1000;
export const acceptedCache = new Map(); // firebaseUid -> hasta cuándo se da por vigente (solo aceptaciones vigentes)

export const latestAcceptance = (userId) => prisma.termsAcceptance.findFirst({ where: { userId, voidedAt: null }, orderBy: { acceptedAt: 'desc' }, select: { termsVersion: true, privacyVersion: true, isAdult: true, acceptedAt: true } });
export const isCurrentAcceptance = (row) => Boolean(row && row.isAdult && row.termsVersion === LEGAL_CURRENT.termsVersion && row.privacyVersion === LEGAL_CURRENT.privacyVersion);

// Estado que se envía al propio usuario: qué versión rige, si ya aceptó y si puede elegir su usuario en este paso
export const getLegalStatus = async (user) => {
  const last = await latestAcceptance(user.id);
  return {
    current: LEGAL_CURRENT,
    accepted: isCurrentAcceptance(last),
    acceptedAt: last?.acceptedAt || null,
    canChooseUsername: !last && Date.now() - new Date(user.createdAt).getTime() < NEW_ACCOUNT_WINDOW_MS
  };
};

// Sin aceptación vigente no se puede escribir nada (crear, editar, pedir, escribir...); leer sí, y las rutas de abajo siempre
const TERMS_EXEMPT = [['POST', '/api/users/sync'], ['POST', '/api/users/me/accept-terms'], ['DELETE', '/api/users/me/unaccepted'], ['DELETE', '/api/users/me']];
export const termsGate = async (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  if (TERMS_EXEMPT.some(([method, route]) => method === req.method && route === path)) return next();
  const token = String(req.headers['authorization'] || '').split(' ')[1];
  if (!token) return next(); // sin sesión: cada ruta decide si lo permite
  try {
    const decoded = await getAuth().verifyIdToken(token);
    if ((acceptedCache.get(decoded.uid) || 0) > Date.now()) return next();
    const user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid }, select: { id: true, role: true } });
    if (!user || user.role === 'deleted') return next();
    if (isCurrentAcceptance(await latestAcceptance(user.id))) {
      acceptedCache.set(decoded.uid, Date.now() + ACCEPTED_CACHE_MS);
      return next();
    }
    return res.status(403).json({ success: false, code: 'terms_required', message: 'Debes aceptar los Términos y Condiciones para continuar' });
  } catch (_error) {
    return next(); // token inválido o error momentáneo: la ruta responde con su propia validación
  }
};
