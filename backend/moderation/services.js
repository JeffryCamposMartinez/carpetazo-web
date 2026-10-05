// Instancias compartidas de moderación: restricciones, huellas visuales, escaneo de imágenes y ganchos.
import { getAuth } from 'firebase-admin/auth';
import { prisma } from '../core/db.js';
import { createImageScanner } from './imageScan.js';
import { createHashBank } from './perceptual.js';
import { createRestrictions } from './sanctions.js';

// Sanciones vigentes: una cuenta suspendida no escribe; con restricciones parciales solo se corta lo que corresponde
export const restrictions = createRestrictions({ prisma, getAuth });
export const hashBank = createHashBank({ prisma });
export const imageScanner = createImageScanner({ prisma });

export const moderationHooks = {};
