// Respaldo de la base de datos desde Moderación → Herramientas. Solo administradores (no co-administradores).
// Se genera al momento y se descarga: nada queda guardado en el servidor. Es de solo lectura; cada descarga queda en la auditoría.
// Formato: NDJSON comprimido (.ndjson.gz). Una línea de encabezado, líneas {"table", "rows"} de hasta 1000 filas y una línea final con los totales.
import { once } from 'node:events';
import zlib from 'node:zlib';
import express from 'express';
import { Prisma } from '@prisma/client';
import { authenticateToken, isCoAdmin, requireStaff } from '../core/auth.js';
import { prisma } from '../core/db.js';
import { badRequest } from '../core/validation.js';

const router = express.Router();
const BATCH = 1000;
// El catálogo de cartas se vuelve a cargar desde sus archivos de origen: no hace falta respaldarlo (y es lo más grande)
const EXCLUDED = /^(Catalog|Tcg)/;
const lowerFirst = (name) => name.charAt(0).toLowerCase() + name.slice(1);
const replacer = (_key, value) => (typeof value === 'bigint' ? Number(value) : value);

const backupModels = () => Prisma.dmmf.datamodel.models.filter((model) => !EXCLUDED.test(model.name));
let running = false; // un respaldo a la vez

const adminOnly = (req, res, next) => (isCoAdmin(req)
  ? res.status(403).json({ success: false, message: 'El respaldo de la base es solo para administradores.' })
  : next());

router.get('/api/admin/backup/status', authenticateToken, requireStaff(3), adminOnly, async (_req, res) => {
  try {
    const last = await prisma.moderationAudit.findFirst({ where: { action: 'backup.download' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, actorId: true } });
    const actor = last?.actorId ? await prisma.user.findUnique({ where: { id: last.actorId }, select: { username: true } }) : null;
    res.json({ success: true, tables: backupModels().length, last: last ? { at: last.createdAt, by: actor?.username || null } : null });
  } catch (error) {
    console.error('Error consultando el respaldo:', error.message);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

router.post('/api/admin/backup', authenticateToken, requireStaff(3), adminOnly, async (req, res) => {
  if (req.body?.confirm !== true) return badRequest(res, 'Confirma el respaldo para continuar');
  if (running) return res.status(409).json({ success: false, message: 'Ya hay un respaldo en curso. Espera a que termine.' });
  running = true;
  let aborted = false;
  res.on('close', () => { if (!res.writableEnded) aborted = true; });
  try {
    const models = backupModels();
    const audit = await prisma.moderationAudit.create({ data: { actorId: req.dbUser.id, action: 'backup.download', targetType: 'system', targetId: 'database', note: 'Respaldo de la base descargado', meta: { tables: models.length } } });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    res.set({ 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="carpetazo-respaldo-${stamp}.ndjson.gz"`, 'Cache-Control': 'no-store' });
    const gzip = zlib.createGzip();
    gzip.pipe(res);
    const write = async (line) => { if (!gzip.write(line + '\n')) await once(gzip, 'drain'); };

    await write(JSON.stringify({ type: 'header', app: 'carpetazo', createdAt: new Date().toISOString(), tables: models.map((model) => model.name), excluded: 'Catalog*, Tcg* (se vuelven a cargar desde sus archivos)' }));
    const counts = {};
    for (const model of models) {
      if (aborted) break;
      const delegate = prisma[lowerFirst(model.name)];
      const idField = model.primaryKey ? null : model.fields.find((field) => field.isId)?.name; // sin id simple: se lee la tabla entera
      let total = 0;
      let last = null;
      for (;;) {
        if (aborted) break;
        const rows = await delegate.findMany(idField
          ? { take: BATCH, orderBy: { [idField]: 'asc' }, ...(last !== null ? { cursor: { [idField]: last }, skip: 1 } : {}) }
          : {});
        if (!rows.length) break;
        await write(JSON.stringify({ table: model.name, rows }, replacer));
        total += rows.length;
        if (!idField || rows.length < BATCH) break;
        last = rows[rows.length - 1][idField];
      }
      counts[model.name] = total;
    }
    await write(JSON.stringify({ type: 'footer', finishedAt: new Date().toISOString(), counts, totalRows: Object.values(counts).reduce((sum, n) => sum + n, 0), complete: !aborted }));
    gzip.end();
    prisma.moderationAudit.update({ where: { id: audit.id }, data: { meta: { tables: models.length, rows: Object.values(counts).reduce((sum, n) => sum + n, 0), complete: !aborted } } }).catch(() => {});
  } catch (error) {
    console.error('Error generando el respaldo:', error.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'No se pudo crear el respaldo' });
    else res.destroy(); // el archivo ya empezó a enviarse: se corta para que no quede un respaldo que parezca completo
  } finally {
    running = false;
  }
});

export default router;
