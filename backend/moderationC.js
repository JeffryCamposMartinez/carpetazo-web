// Moderación, Fase C (documento 20): reputación de quien reporta, huellas visuales, detección automática en textos,
// métricas del panel, retención automática e informe de un caso para autoridades.
import { analyzeText } from './textSignals.js';
import { AUTO_REASONS, REPORT_TARGETS, findReason } from './reportReasons.js';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// Cuánto tiempo se conserva cada cosa (Política de Privacidad, sección 6). Se pueden ajustar sin tocar el resto del código.
export const RETENTION = {
  evidenceDismissedDays: 90,   // evidencias de reportes descartados
  evidenceActionedDays: 365,   // evidencias de reportes con medida (cubre apelaciones y requerimientos)
  reportDismissedDays: 180,    // reportes descartados
  reportActionedDays: 730,     // reportes con medida
  appealDays: 730,
  sanctionDays: 730,           // medidas levantadas o vencidas
  caseDays: 730,               // casos de estafa resueltos
  auditDays: 1095,             // auditoría: responsabilidad del equipo
  imageHashDays: 180,          // huellas de imágenes que nunca se prohibieron
  scanEventDays: 90            // registro de escaneos de imágenes (métricas)
};

// Plazo de primera revisión según gravedad (horas)
const SLA_HOURS = { S1: 24, S2: 72, S3: 168, S4: 336 };

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);

export const registerModerationC = (app, deps) => {
  const { prisma, authenticateToken, requireStaff, hooks, moderation, badRequest, isUuid, currentUserId, escapeHtml, hashBank, imageScanner } = deps;
  const { cleanText, hasBadControlChars } = moderation;

  // ============ Reputación de quien reporta ============
  // Tasa de reportes confirmados con suavizado (empieza en 1,0); con 5 o más descartados y casi ninguno confirmado, su peso baja
  // y sus reportes ya no activan medidas automáticas (siguen llegando a la cola).
  hooks.reporterWeight = async (userId) => {
    const rows = await prisma.report.groupBy({ by: ['status'], where: { reporterId: userId, status: { in: ['actioned', 'dismissed'] } }, _count: { _all: true } });
    const confirmed = rows.find((row) => row.status === 'actioned')?._count._all || 0;
    const dismissed = rows.find((row) => row.status === 'dismissed')?._count._all || 0;
    const rate = (confirmed + 1) / (confirmed + dismissed + 2);
    const low = dismissed >= 5 && rate < 0.25;
    return { weight: low ? 0.25 : Math.round((0.5 + rate) * 100) / 100, low };
  };

  // ============ Huellas visuales ============
  const imageUrlOf = (report) => {
    const snapshot = report.snapshot || {};
    if (typeof snapshot.value === 'string') return snapshot.value;
    if (typeof snapshot.imageUrl === 'string') return snapshot.imageUrl;
    if (typeof snapshot.content === 'string') {
      try {
        const parsed = JSON.parse(snapshot.content);
        if (parsed && typeof parsed.imageUrl === 'string') return parsed.imageUrl;
      } catch (_error) { /* mensaje antiguo */ }
    }
    return null;
  };
  hooks.banImage = async (report) => {
    const url = imageUrlOf(report);
    if (!url) return;
    const banned = await hashBank.banByUrl(url);
    if (banned) await prisma.moderationAudit.create({ data: { actorId: null, action: 'phash.banned', targetType: report.targetType, targetId: report.targetId, reportId: report.id, note: 'La huella visual de la imagen quedó prohibida' } });
  };

  // ============ Detección automática en textos ============
  const SHORT_CODE_RETRIES = 4;
  const flagText = async (targetType, targetId, text, context, viewerId = null) => {
    const codes = analyzeText(text, context);
    if (!codes.length) return 0;
    let created = 0;
    for (const code of codes) {
      const reasonCode = `auto.${code}`;
      const reason = AUTO_REASONS[reasonCode];
      if (!reason) continue;
      // Si ya se marcó (aunque se haya descartado), no se vuelve a abrir
      if (await prisma.report.findFirst({ where: { targetType, targetId, reasonCode }, select: { id: true } })) continue;
      const resolved = await moderation.resolveTarget(targetType, targetId, { id: viewerId });
      if (resolved.error) continue;
      for (let attempt = 0; attempt < SHORT_CODE_RETRIES; attempt += 1) {
        try {
          await prisma.report.create({ data: { shortCode: moderation.newShortCode(), targetType, targetId, targetOwnerId: resolved.ownerId, reasonCode, severity: reason.severity, extra: { contexto: context }, reporterId: null, weight: 1, snapshot: resolved.snapshot } });
          created += 1;
          break;
        } catch (error) {
          if (error.code === 'P2002' && JSON.stringify(error.meta?.target || '').includes('shortCode')) continue;
          throw error;
        }
      }
    }
    return created;
  };
  hooks.flagText = (targetType, targetId, text, context, viewerId) => flagText(targetType, targetId, text, context, viewerId).catch((error) => console.error('Error flagging text:', error.message));

  // ============ Imágenes retenidas o a revisar por el escaneo automático ============
  const IMAGE_TARGETS = { avatar: ['profile_image', 'photoURL'], banner: ['profile_banner', 'bannerBase64'], wallpaper: ['profile_wallpaper', 'wallpaperBase64'] };
  // hide = true: la imagen queda fuera del perfil hasta que una persona la revise ("pendiente"); false: se publica y entra a la cola
  hooks.holdImage = async ({ userId, type, url, reasonCode, hide }) => {
    const target = IMAGE_TARGETS[type];
    if (!target || !url) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const created = await tx.report.create({ data: { shortCode: moderation.newShortCode(), targetType: target[0], targetId: userId, targetOwnerId: userId, reasonCode, severity: AUTO_REASONS[reasonCode].severity, reporterId: null, weight: 1, extra: { origen: 'escaneo de imágenes' }, snapshot: { username: user?.username || null, field: target[1], value: url } } });
          if (hide) {
            const applied = await moderation.applyHide(tx, created, 'hide');
            if (applied.ok) {
              await tx.report.update({ where: { id: created.id }, data: { autoActioned: true } });
              await tx.moderationAudit.create({ data: { actorId: null, action: 'auto.hide', targetType: target[0], targetId: userId, reportId: created.id, note: 'Imagen retenida: pendiente de revisión' } });
            }
          }
          return created;
        });
      } catch (error) {
        if (error.code === 'P2002' && JSON.stringify(error.meta?.target || '').includes('shortCode')) continue;
        throw error;
      }
    }
    return null;
  };

  // ============ Retención ============
  const runRetention = async () => {
    const before = (days) => new Date(Date.now() - days * DAY);
    const openAppeals = await prisma.appeal.findMany({ where: { status: 'open', reportId: { not: null } }, select: { reportId: true } });
    const protectedReports = openAppeals.map((row) => row.reportId);
    const notProtected = protectedReports.length ? { id: { notIn: protectedReports } } : {};
    const counts = {};
    counts.evidenceDismissed = (await prisma.evidence.deleteMany({ where: { report: { status: 'dismissed', decidedAt: { lt: before(RETENTION.evidenceDismissedDays) }, ...notProtected } } })).count;
    counts.evidenceActioned = (await prisma.evidence.deleteMany({ where: { report: { status: 'actioned', decidedAt: { lt: before(RETENTION.evidenceActionedDays) }, ...notProtected } } })).count;
    counts.reportsDismissed = (await prisma.report.deleteMany({ where: { status: 'dismissed', decidedAt: { lt: before(RETENTION.reportDismissedDays) }, ...notProtected } })).count;
    counts.reportsActioned = (await prisma.report.deleteMany({ where: { status: 'actioned', decidedAt: { lt: before(RETENTION.reportActionedDays) }, ...notProtected } })).count;
    counts.appeals = (await prisma.appeal.deleteMany({ where: { status: { in: ['accepted', 'rejected'] }, decidedAt: { lt: before(RETENTION.appealDays) } } })).count;
    counts.sanctions = (await prisma.sanction.deleteMany({ where: { status: { in: ['revoked', 'expired', 'rejected'] }, createdAt: { lt: before(RETENTION.sanctionDays) } } })).count;
    counts.cases = (await prisma.fraudCase.deleteMany({ where: { status: 'resolved', resolvedAt: { lt: before(RETENTION.caseDays) } } })).count;
    counts.imageHashes = (await prisma.imageHash.deleteMany({ where: { banned: false, createdAt: { lt: before(RETENTION.imageHashDays) } } })).count;
    counts.scanEvents = (await prisma.scanEvent.deleteMany({ where: { createdAt: { lt: before(RETENTION.scanEventDays) } } })).count;
    counts.audit = (await prisma.moderationAudit.deleteMany({ where: { createdAt: { lt: before(RETENTION.auditDays) }, action: { not: 'retention.run' } } })).count;
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    await prisma.moderationAudit.create({ data: { actorId: null, action: 'retention.run', note: `Retención: ${total} registros eliminados`, meta: counts } });
    return { counts, total };
  };
  const scheduleRetention = () => {
    const tick = () => runRetention().catch((error) => console.error('Error running retention:', error.message));
    setInterval(tick, DAY).unref();
    setTimeout(tick, 3 * 60 * 1000).unref();
  };
  if (process.env.RETENTION_DISABLED !== '1') scheduleRetention();

  app.get('/api/admin/retention', authenticateToken, requireStaff(3), async (_req, res) => {
    try {
      const last = await prisma.moderationAudit.findFirst({ where: { action: 'retention.run' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, meta: true, note: true } });
      res.json({ success: true, policy: RETENTION, last });
    } catch (error) {
      console.error('Error loading retention:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  app.post('/api/admin/retention/run', authenticateToken, requireStaff(3), async (_req, res) => {
    try {
      res.json({ success: true, ...(await runRetention()) });
    } catch (error) {
      console.error('Error running retention:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // ============ Métricas ============
  app.get('/api/admin/metrics', authenticateToken, requireStaff(3), async (_req, res) => {
    try {
      const now = Date.now();
      const since = new Date(now - 30 * DAY);
      const [recent, open, cases, sanctions, appealsOpen, autoBlocked, bannedHashes, lastRetention, lowWeight, scanEvents, recentScanIssues, scanUsage] = await Promise.all([
        prisma.report.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, targetType: true, severity: true, status: true, reasonCode: true, decidedAt: true, reporterId: true }, take: 20000 }),
        prisma.report.findMany({ where: { status: 'open' }, select: { severity: true, createdAt: true } }),
        prisma.fraudCase.findMany({ where: { status: { not: 'resolved' } }, select: { status: true, priority: true, responseDueAt: true, sellerRespondedAt: true } }),
        prisma.sanction.groupBy({ by: ['type'], where: { status: 'active' }, _count: { _all: true } }),
        prisma.appeal.findMany({ where: { status: 'open' }, select: { createdAt: true } }),
        prisma.moderationAudit.count({ where: { action: 'phash.blocked', createdAt: { gte: since } } }),
        prisma.imageHash.count({ where: { banned: true } }),
        prisma.moderationAudit.findFirst({ where: { action: 'retention.run' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, note: true } }),
        prisma.report.count({ where: { createdAt: { gte: since }, weight: { lt: 0.5 } } }),
        prisma.scanEvent.findMany({ where: { createdAt: { gte: since } }, select: { provider: true, verdict: true, fallback: true, ms: true }, take: 50000 }),
        prisma.scanEvent.findMany({ where: { detail: { not: null } }, orderBy: { createdAt: 'desc' }, take: 8, select: { createdAt: true, kind: true, verdict: true, detail: true, provider: true } }),
        imageScanner ? imageScanner.usageSnapshot() : []
      ]);

      const perDay = Array.from({ length: 30 }, (_, index) => {
        const day = new Date(now - (29 - index) * DAY);
        return { date: day.toISOString().slice(0, 10), count: 0 };
      });
      const dayIndex = new Map(perDay.map((row, index) => [row.date, index]));
      const byType = {};
      const bySeverity = {};
      const byReason = {};
      const hoursToDecision = [];
      let dismissed = 0;
      let actioned = 0;
      let automatic = 0;
      for (const row of recent) {
        const index = dayIndex.get(row.createdAt.toISOString().slice(0, 10));
        if (index !== undefined) perDay[index].count += 1;
        byType[row.targetType] = (byType[row.targetType] || 0) + 1;
        bySeverity[row.severity] = (bySeverity[row.severity] || 0) + 1;
        byReason[row.reasonCode] = (byReason[row.reasonCode] || 0) + 1;
        if (row.reporterId === null) automatic += 1;
        if (row.status === 'dismissed') dismissed += 1;
        if (row.status === 'actioned') actioned += 1;
        if (row.decidedAt) hoursToDecision.push((row.decidedAt.getTime() - row.createdAt.getTime()) / HOUR);
      }
      const backlog = { S1: 0, S2: 0, S3: 0, S4: 0 };
      const overdue = { S1: 0, S2: 0, S3: 0, S4: 0 };
      let oldestOpenHours = 0;
      for (const row of open) {
        backlog[row.severity] = (backlog[row.severity] || 0) + 1;
        const age = (now - row.createdAt.getTime()) / HOUR;
        oldestOpenHours = Math.max(oldestOpenHours, age);
        if (age > (SLA_HOURS[row.severity] || 336)) overdue[row.severity] = (overdue[row.severity] || 0) + 1;
      }
      const decided = dismissed + actioned;
      res.json({
        success: true,
        generatedAt: new Date(now).toISOString(),
        last30Days: {
          total: recent.length,
          automatic,
          perDay,
          byType: Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, label: REPORT_TARGETS[type]?.label || type, count })),
          bySeverity,
          topReasons: Object.entries(byReason).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, count]) => ({ code, label: findReason(code.split('.')[0], code)?.label || code, count })),
          dismissedRate: decided ? Math.round((dismissed / decided) * 100) : null,
          hoursToDecision: { average: round1(hoursToDecision.length ? hoursToDecision.reduce((sum, value) => sum + value, 0) / hoursToDecision.length : null), median: round1(median(hoursToDecision)) },
          lowWeightReports: lowWeight
        },
        queue: { open: open.length, backlog, overdue, slaHours: SLA_HOURS, oldestOpenHours: Math.round(oldestOpenHours) },
        cases: {
          open: cases.length,
          highPriority: cases.filter((row) => row.priority === 'high').length,
          awaitingResponse: cases.filter((row) => row.status === 'awaiting_response').length,
          responseOverdue: cases.filter((row) => row.status === 'awaiting_response' && !row.sellerRespondedAt && row.responseDueAt && row.responseDueAt.getTime() < now).length
        },
        sanctionsActive: Object.fromEntries(sanctions.map((row) => [row.type, row._count._all])),
        appeals: { open: appealsOpen.length, oldestOpenHours: appealsOpen.length ? Math.round((now - Math.min(...appealsOpen.map((row) => row.createdAt.getTime()))) / HOUR) : 0 },
        images: { bannedHashes, uploadsBlocked30d: autoBlocked },
        scans: (() => {
          const byProvider = {};
          const byVerdict = {};
          const latencies = [];
          let fallbacks = 0;
          for (const event of scanEvents) {
            byProvider[event.provider] = (byProvider[event.provider] || 0) + 1;
            byVerdict[event.verdict] = (byVerdict[event.verdict] || 0) + 1;
            if (event.fallback) fallbacks += 1;
            if (!['cache', 'none'].includes(event.provider)) latencies.push(event.ms);
          }
          latencies.sort((a, b) => a - b);
          const percentile = (p) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] : null);
          return { enabled: Boolean(imageScanner?.enabled), providers: scanUsage, last30d: { total: scanEvents.length, byProvider, byVerdict, fallbacks, unavailable: byVerdict.unavailable || 0, cacheHits: byProvider.cache || 0, latencyMs: { p50: percentile(0.5), p95: percentile(0.95) }, recentIssues: recentScanIssues } };
        })(),
        retention: { policy: RETENTION, lastRun: lastRetention }
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  // ============ Informe de un caso para autoridades ============
  // Solo administradores, con el motivo escrito (requerimiento, denuncia o fundamento legal) y registro en la auditoría.
  // No incluye correo, RUT, teléfono ni datos bancarios: esos se entregan solo mediante requerimiento formal, revisado por un abogado.
  const REPORTER_ROLE = { buyer: 'comprador', seller: 'vendedor' };
  const dateText = (value) => (value ? new Date(value).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—');

  const buildHtml = (doc) => {
    const row = (label, value) => (value === null || value === undefined || value === '' ? '' : `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`);
    const section = (title, body) => `<h2>${escapeHtml(title)}</h2>${body}`;
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe ${escapeHtml(doc.case.shortCode)} — Carpetazo.cl</title><style>
body{font-family:system-ui,Segoe UI,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#1e293b;line-height:1.5}
h1{color:#12315f}h2{color:#12315f;border-bottom:2px solid #facc15;padding-bottom:4px;margin-top:28px}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #cbd5e1;padding:6px 10px;text-align:left;vertical-align:top;font-size:14px}th{background:#f1f5f9;width:30%}
.note{background:#fef9c3;border:1px solid #facc15;padding:10px 14px;border-radius:8px;font-size:13px}.small{font-size:12px;color:#64748b}
@media print{body{margin:0}}</style></head><body>
<h1>Informe del caso ${escapeHtml(doc.case.shortCode)}</h1>
<p class="note">Documento generado por Carpetazo.cl el ${escapeHtml(dateText(doc.generatedAt))} por ${escapeHtml(doc.generatedBy)}. Motivo de la entrega: ${escapeHtml(doc.purpose)}${doc.reference ? ` (referencia: ${escapeHtml(doc.reference)})` : ''}. Contiene solo datos de la plataforma; los datos personales de contacto se entregan mediante requerimiento formal.</p>
${section('Resumen', `<table>${row('Código del caso', doc.case.shortCode)}${row('Estado', doc.case.status)}${row('Prioridad', doc.case.priority)}${row('Abierto', dateText(doc.case.openedAt))}${row('Resolución', doc.case.resolution)}${row('Nota de resolución', doc.case.resolutionNote)}${row('Resuelto', doc.case.resolvedAt ? dateText(doc.case.resolvedAt) : '')}</table>`)}
${section('Persona investigada', `<table>${row('Usuario', doc.subject?.username)}${row('Nombre público', doc.subject?.name)}${row('Cuenta creada', dateText(doc.subject?.createdAt))}${row('Ventas completadas', doc.subject?.completedSales)}${row('Medidas vigentes', doc.subject?.activeSanctions)}</table>`)}
${section(`Reportes (${doc.reports.length})`, doc.reports.map((report) => `<table>${row('Código', report.shortCode)}${row('Fecha', dateText(report.createdAt))}${row('Motivo', report.reason)}${row('Gravedad', report.severity)}${row('Quien reportó', report.reporter ? `@${report.reporter.username} (${REPORTER_ROLE[report.reporterRole] || 'usuario'}, cuenta creada ${dateText(report.reporter.accountCreatedAt)})` : 'Detección automática')}${row('Comentario', report.comment)}${row('Datos adicionales', report.extra ? Object.entries(report.extra).map(([key, value]) => `${key}: ${value}`).join(' · ') : '')}${row('Evidencias', report.evidence.length ? report.evidence.map((item) => `${dateText(item.createdAt)} · ${item.size} bytes · sha256 ${item.sha256}`).join('\n') : 'ninguna')}</table>`).join(''))}
${doc.orders.length ? section(`Pedidos vinculados (${doc.orders.length})`, `<table><tr><th>Código</th><th>Total</th><th>Estado</th><th>Creado</th><th>Actualizado</th></tr>${doc.orders.map((order) => `<tr><td>${escapeHtml(order.code || '')}</td><td>${escapeHtml(String(order.total))}</td><td>${escapeHtml(order.status)}</td><td>${escapeHtml(dateText(order.createdAt))}</td><td>${escapeHtml(dateText(order.updatedAt))}</td></tr>`).join('')}</table>`) : ''}
${section('Versión del vendedor', doc.sellerResponse ? `<p>${escapeHtml(doc.sellerResponse)}</p><p class="small">Recibida ${escapeHtml(dateText(doc.sellerRespondedAt))}</p>` : '<p>No respondió o no se solicitó el descargo.</p>')}
${section('Medidas aplicadas', doc.sanctions.length ? `<table><tr><th>Tipo</th><th>Estado</th><th>Fecha</th><th>Motivo</th></tr>${doc.sanctions.map((item) => `<tr><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.status)}${item.automatic ? ' (automática)' : ''}</td><td>${escapeHtml(dateText(item.createdAt))}</td><td>${escapeHtml(item.reason)}</td></tr>`).join('')}</table>` : '<p>Sin medidas.</p>')}
${section('Línea de tiempo', doc.timeline.length ? `<table>${doc.timeline.map((entry) => `<tr><td style="width:24%">${escapeHtml(dateText(entry.createdAt))}</td><td>${escapeHtml(entry.action)}${entry.note ? ` — ${escapeHtml(entry.note)}` : ''}</td></tr>`).join('')}</table>` : '<p>Sin acciones registradas.</p>')}
<p class="small">Carpetazo.cl · documento confidencial · no reemplaza una certificación legal.</p></body></html>`;
  };

  app.post('/api/admin/cases/:id/export', authenticateToken, requireStaff(3), async (req, res) => {
    try {
      if (!isUuid(req.params.id)) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      const purpose = typeof req.body?.purpose === 'string' ? cleanText(req.body.purpose, 301) : '';
      if (purpose.length < 10 || purpose.length > 300 || hasBadControlChars(req.body.purpose)) return badRequest(res, 'Escribe el motivo de la entrega (requerimiento, denuncia o fundamento legal), entre 10 y 300 caracteres');
      const reference = req.body?.reference === undefined || req.body?.reference === null ? '' : (typeof req.body.reference === 'string' && req.body.reference.length <= 100 && !hasBadControlChars(req.body.reference) ? cleanText(req.body.reference, 100) : null);
      if (reference === null) return badRequest(res, 'Referencia inválida');
      const fraudCase = await prisma.fraudCase.findUnique({ where: { id: req.params.id } });
      if (!fraudCase) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
      const actorId = await currentUserId(req);
      const [subject, reports, sanctions, audit, completedSales, actor] = await Promise.all([
        prisma.user.findUnique({ where: { id: fraudCase.subjectUserId }, select: { username: true, name: true, createdAt: true } }),
        prisma.report.findMany({ where: { caseId: fraudCase.id }, orderBy: { createdAt: 'asc' }, take: 200, include: { reporter: { select: { username: true, createdAt: true } }, evidence: { select: { id: true, size: true, sha256: true, createdAt: true } } } }),
        prisma.sanction.findMany({ where: { userId: fraudCase.subjectUserId }, orderBy: { createdAt: 'asc' }, select: { type: true, status: true, reason: true, automatic: true, createdAt: true } }),
        prisma.moderationAudit.findMany({ where: { targetType: 'case', targetId: fraudCase.id }, orderBy: { createdAt: 'asc' }, select: { action: true, note: true, createdAt: true } }),
        prisma.order.count({ where: { sellerId: fraudCase.subjectUserId, status: 'completed' } }),
        prisma.user.findUnique({ where: { id: actorId }, select: { username: true } })
      ]);
      const orders = reports.filter((report) => report.targetType === 'order' && report.snapshot).map((report) => ({ code: report.snapshot.code, total: report.snapshot.total, status: report.snapshot.status, createdAt: report.snapshot.createdAt, updatedAt: report.snapshot.updatedAt }));
      const doc = {
        generatedAt: new Date().toISOString(),
        generatedBy: actor?.username ? `@${actor.username}` : 'administrador',
        purpose, reference,
        case: { shortCode: fraudCase.shortCode, status: fraudCase.status, priority: fraudCase.priority, openedAt: fraudCase.openedAt, resolution: fraudCase.resolution, resolutionNote: fraudCase.resolutionNote, resolvedAt: fraudCase.resolvedAt },
        subject: subject ? { username: subject.username, name: subject.name, createdAt: subject.createdAt, completedSales, activeSanctions: sanctions.filter((row) => row.status === 'active').length } : null,
        reports: reports.map((report) => ({ shortCode: report.shortCode, createdAt: report.createdAt, reason: findReason(report.targetType, report.reasonCode)?.label || report.reasonCode, severity: report.severity, comment: report.comment, extra: report.extra, reporterRole: report.reporterRole, reporter: report.reporter ? { username: report.reporter.username, accountCreatedAt: report.reporter.createdAt } : null, evidence: report.evidence })),
        orders,
        sellerResponse: fraudCase.sellerResponse,
        sellerRespondedAt: fraudCase.sellerRespondedAt,
        sanctions,
        timeline: audit
      };
      await prisma.moderationAudit.create({ data: { actorId, action: 'case.exported', targetType: 'case', targetId: fraudCase.id, note: `Informe exportado. Motivo: ${purpose}${reference ? ` (ref. ${reference})` : ''}`, meta: { reports: reports.length } } });
      res.json({ success: true, filename: `informe-${fraudCase.shortCode}.html`, html: buildHtml(doc), data: doc });
    } catch (error) {
      console.error('Error exporting case:', error);
      res.status(500).json({ success: false, message: 'Error interno' });
    }
  });

  return { flagText, runRetention };
};
