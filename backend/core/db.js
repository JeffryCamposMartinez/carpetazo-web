// Cliente único de la base de datos.
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
