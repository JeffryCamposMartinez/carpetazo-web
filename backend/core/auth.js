// Sesión (token de Firebase), equipo de moderación y administradores.
import { getAuth } from 'firebase-admin/auth';
import { prisma } from './db.js';

// Una cuenta desactivada o borrada en Firebase, o con las sesiones cerradas, deja de entrar en minutos y no al vencer
// su token (que dura 1 hora). Necesita una cuenta de servicio de Firebase (GOOGLE_APPLICATION_CREDENTIALS): sin ella
// no se consulta, porque cada intento fallido haría esperar a la petición. Se consulta como mucho cada 5 minutos por
// persona; si Firebase no responde, se confía en el token (y no se reintenta hasta 5 minutos después).
const REVOCATION_CHECK_MS = 5 * 60 * 1000;
const canCheckRevocation = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.TEST_AUTH_STUB === '1');
const revocationChecks = new Map(); // uid → { at, disabled, validAfter (segundos) }
const sessionRevoked = async (decoded) => {
  if (!canCheckRevocation) return false;
  let entry = revocationChecks.get(decoded.uid);
  if (!entry || Date.now() - entry.at > REVOCATION_CHECK_MS) {
    try {
      const record = await getAuth().getUser(decoded.uid);
      entry = { at: Date.now(), disabled: Boolean(record.disabled), validAfter: record.tokensValidAfterTime ? Date.parse(record.tokensValidAfterTime) / 1000 : 0 };
    } catch (error) {
      entry = { at: Date.now(), disabled: error?.code === 'auth/user-not-found', validAfter: 0 };
    }
    if (revocationChecks.size > 20000) revocationChecks.clear();
    revocationChecks.set(decoded.uid, entry);
  }
  return entry.disabled || Boolean(entry.validAfter && decoded.auth_time && decoded.auth_time < entry.validAfter);
};

// Middleware to validate Firebase ID Token
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticación requerido' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    if (await sessionRevoked(decodedToken)) return res.status(401).json({ success: false, code: 'session_revoked', message: 'Tu sesión ya no es válida. Vuelve a iniciar sesión.' });
    req.user = decodedToken; // Contains user payload (uid, email, etc.)
    req.user.sub = decodedToken.uid; // Ensure 'sub' maps to 'uid' for backwards compatibility
    next();
  } catch (error) {
    console.error('Error al verificar token Firebase:', error.message);
    return res.status(403).json({ success: false, message: 'Token de autenticación inválido o expirado' });
  }
};

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

export const isAdminEmail = (email) => Boolean(email && adminEmails.includes(String(email).toLowerCase()));

// Una medida vigente de suspensión o cierre corta el acceso al equipo (también de lectura). La cuenta propietaria nunca se corta.
const staffBlocked = async (user) => {
  if (!user || user.isOwner) return false;
  const active = await prisma.sanction.findFirst({
    where: { userId: user.id, type: { in: ['suspend', 'ban'] }, status: 'active', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { id: true }
  });
  return Boolean(active);
};

// Equipo de moderación: 1 = soporte (solo lectura), 2 = moderador, 3 = administrador
export const requireStaff = (minLevel) => async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const firebaseAdminClaim = req.user?.admin === true || req.user?.role === 'admin';
    const envAdmin = req.user.email_verified === true && isAdminEmail(req.user.email);
    let level = 0;
    if (firebaseAdminClaim || envAdmin || user?.role === 'admin') level = 3;
    else if (user?.role === 'moderator') level = 2;
    else if (user?.role === 'support') level = 1;
    if (level < minLevel) return res.status(403).json({ success: false, message: 'Acceso restringido' });
    if (await staffBlocked(user)) return res.status(403).json({ success: false, code: 'staff_suspended', message: 'Tu acceso al equipo está suspendido' });
    req.staffLevel = level;
    req.dbUser = user;
    next();
  } catch (error) {
    console.error('Error checking staff permissions:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    const firebaseAdminClaim = req.user?.admin === true || req.user?.role === 'admin';
    const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub } });
    const databaseAdmin = user?.role === 'admin';
    // El correo solo cuenta si Firebase confirma que fue verificado
    const envAdmin = req.user.email_verified === true && isAdminEmail(req.user.email);

    if (!firebaseAdminClaim && !databaseAdmin && !envAdmin) {
      return res.status(403).json({ success: false, message: 'Acceso administrativo requerido' });
    }
    if (await staffBlocked(user)) return res.status(403).json({ success: false, code: 'staff_suspended', message: 'Tu acceso al equipo está suspendido' });

    req.dbUser = user;
    next();
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
};

// Obtener detalles de una carpeta (y sus cartas)
// --- Vistas públicas: nunca se devuelve la entidad de la base de datos ---
// Cualquier campo que no esté en estas listas NO sale por las rutas públicas (correo, RUT, banco, rol, firebaseUid…).
export const optionalAuth = async (req, _res, next) => {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (token) {
    try {
      req.user = await getAuth().verifyIdToken(token);
      req.user.sub = req.user.uid;
    } catch (_error) {
      // token inválido o vencido: se trata como visitante anónimo
    }
  }
  next();
};

export const currentUserId = async (req) => {
  const user = await prisma.user.findUnique({ where: { firebaseUid: req.user.sub }, select: { id: true } });
  return user?.id || null;
};
