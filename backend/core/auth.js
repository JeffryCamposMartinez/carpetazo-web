// Sesión (token de Firebase), equipo de moderación y administradores.
import { getAuth } from 'firebase-admin/auth';
import { prisma } from './db.js';

// Middleware to validate Firebase ID Token
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticación requerido' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
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
