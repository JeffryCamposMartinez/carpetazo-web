// Cliente único de la base de datos.
import { PrismaClient } from '@prisma/client';

// Prisma abre por defecto (CPUs × 2 + 1) conexiones, solo 5 en el VPS, y las tareas periódicas
// compiten con las visitas. Si la URL no fija el tamaño, se amplía el pool (DB_POOL_SIZE, 15 por defecto).
const withPool = (raw) => {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', String(Math.min(50, Math.max(1, Number.parseInt(process.env.DB_POOL_SIZE, 10) || 15))));
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    return url.toString();
  } catch (_error) { return raw; }
};

export const prisma = process.env.DATABASE_URL
  ? new PrismaClient({ datasources: { db: { url: withPool(process.env.DATABASE_URL) } } })
  : new PrismaClient();
