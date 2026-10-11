// Punto de entrada de la API: arma la app (seguridad, límites, términos, sanciones) y monta las rutas de routes/ y moderation/.
import './core/env.js';
import helmet from 'helmet';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase-admin/app';
import { prisma } from './core/db.js';
import { authenticateToken, currentUserId, requireStaff } from './core/auth.js';
import { applyRouteLimits, limiter } from './core/limits.js';
import { termsGate } from './core/legal.js';
import { hashConnection } from './core/hashing.js';
import { escapeHtml, sendUserEmail } from './core/mail.js';
import { badRequest, isUuid } from './core/validation.js';
import { REPORT_TARGETS, findReason } from './moderation/reportReasons.js';
import { registerReports } from './moderation/reports.js';
import { registerSanctions } from './moderation/sanctions.js';
import { registerAutomation } from './moderation/automation.js';
import { hashBank, imageScanner, moderationHooks, restrictions } from './moderation/services.js';
import catalogRoutes from './routes/catalog.js';
import userRoutes from './routes/users.js';
import uploadRoutes from './routes/uploads.js';
import adminRoutes from './routes/admin.js';
import folderRoutes from './routes/folders.js';
import orderRoutes from './routes/orders.js';
import reviewRoutes, { REVIEW_HIDE_REPORTS } from './routes/reviews.js';
import sellerRoutes from './routes/sellers.js';
import cardRoutes from './routes/cards.js';
import wishlistRoutes from './routes/wishlist.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';
import legalRoutes from './routes/legal.js';
import catalogImportRoutes from './routes/catalogImport.js';
import linkPreviewRoutes from './routes/linkPreview.js';
import seoRoutes from './routes/seo.js';
import notificationRoutes from './routes/notifications.js';
import onboardingRoutes from './routes/onboarding.js';
import opsRoutes from './routes/ops.js';
import teamRoutes from './routes/team.js';
import { installErrorCapture, purgeOldErrors, requestContext } from './core/errorLog.js';
import { startOnboardingNudges } from './core/onboarding.js';
import { startWishlistAlerts } from './core/wishlistAlerts.js';
import { startPriceHistory } from './core/priceHistory.js';
import { startMarketPriceHistory } from './core/marketPriceHistory.js';
import { startPriceWatch } from './moderation/priceWatch.js';
import { startPreviewWarmer } from './core/folderPreview.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIREBASE_PROJECT_ID = 'carpetazo-db9d7';

initializeApp({
  projectId: FIREBASE_PROJECT_ID
});

const app = express();
const port = process.env.PORT || 8000;
installErrorCapture();
app.use(requestContext);

const corsOptions = {
  // Solo el sitio publicado: en local la web llama a la API por el proxy de Vite (mismo origen), sin CORS
  origin: ['https://carpetazo.cl', 'https://www.carpetazo.cl'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
};

// Estado del servicio para monitores externos y para el healthcheck de Coolify: responde 503 si la base de datos no contesta
app.get('/api/health', cors(corsOptions), async (_req, res) => {
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), 3000))]);
    res.json({ success: true, status: 'ok', db: 'ok', uptime: Math.round(process.uptime()) });
  } catch (_error) {
    res.status(503).json({ success: false, status: 'degraded', db: 'down' });
  }
});

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use('/api', limiter);
applyRouteLimits(app);

// La carga de cartas nuevas trae un archivo más grande que el resto de la API (solo administradores, con su propio límite)
app.use('/api/admin/catalog-import', express.json({ limit: '12mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Sin aceptación vigente de los Términos no se puede escribir nada (core/legal.js)
app.use('/api', termsGate);
// Sanciones vigentes: una cuenta suspendida no escribe; con restricciones parciales solo se corta lo que corresponde
app.use('/api', restrictions.gate);

// Ninguna ruta de un módulo coincide con la de otro: el orden de montaje no cambia qué ruta responde
app.use(catalogRoutes);
app.use(userRoutes);
app.use(uploadRoutes);
app.use(adminRoutes);
app.use(folderRoutes);
app.use(orderRoutes);
app.use(reviewRoutes);
app.use(sellerRoutes);
app.use(cardRoutes);
app.use(wishlistRoutes);
app.use(catalogImportRoutes);
app.use(linkPreviewRoutes);
app.use(seoRoutes);
app.use(notificationRoutes);
app.use(opsRoutes);
app.use(onboardingRoutes);
app.use(teamRoutes);
app.use(chatRoutes);
app.use(messageRoutes);

const moderation = registerReports(app, { prisma, authenticateToken, requireStaff, hooks: moderationHooks, badRequest, isUuid, currentUserId, hashConnection, sendUserEmail, escapeHtml, reviewHideReports: REVIEW_HIDE_REPORTS });
registerAutomation(app, { prisma, authenticateToken, requireStaff, hooks: moderationHooks, moderation, badRequest, isUuid, currentUserId, escapeHtml, hashBank, imageScanner });
registerSanctions(app, { prisma, authenticateToken, requireStaff, hooks: moderationHooks, restrictions, moderation, badRequest, isUuid, currentUserId, sendUserEmail, escapeHtml, targetLabel: (type) => REPORT_TARGETS[type]?.label || 'contenido', reasonLabel: (type, code) => findReason(type, code)?.label || 'Otro motivo' });

app.use(legalRoutes);

// --- Image Cache Proxy ---
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/images/myl', express.static(path.join(__dirname, 'data/images/myl')));

// Rutas /api inexistentes y errores no controlados: mensajes genéricos, el detalle queda solo en el log
app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'La solicitud es demasiado grande' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ success: false, message: 'Solicitud inválida' });
  console.error('Error no controlado:', err?.message || err);
  res.status(err?.status && err.status < 500 ? err.status : 500).json({ success: false, message: 'Error interno del servidor' });
});

app.listen(port, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
    startPreviewWarmer();
    startWishlistAlerts();
    startOnboardingNudges();
    startPriceHistory();
    startMarketPriceHistory();
    startPriceWatch();
    if (!process.env.TEST_AUTH_STUB) setInterval(() => purgeOldErrors().catch(() => {}), 6 * 60 * 60 * 1000).unref();
});
