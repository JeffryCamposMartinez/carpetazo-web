// Permisos de los empleados de una tienda. Único lugar donde se decide qué puede hacer cada persona:
//  - sales: venta en persona · pickups: retiros en tienda
//  - stock: cantidades y precios de las cartas
//  - folders: editar carpetas (estado de la carta y quitar cartas); incluye stock
// El dueño marca casillas por persona; se guardan en `StoreMember.role` separadas por coma (p. ej. «sales,pickups»).
// Los valores antiguos «cashier» y «stock» siguen valiendo. Un empleado nunca ve datos bancarios, plan, ajustes, informes, equipo ni la ficha del local.
// Solo vale con el plan Tienda vigente del dueño.
import { getEffectivePlan } from './entitlements.js';

export const STORE_PERMISSIONS = ['sales', 'pickups', 'stock', 'folders'];
const LEGACY_ROLES = { cashier: ['sales', 'pickups'], stock: ['stock'] };

// Permisos de una persona a partir de lo guardado en `role`
export const permissionsOf = (role) => LEGACY_ROLES[role] || String(role || '').split(',').filter((item) => STORE_PERMISSIONS.includes(item));

// Casillas enviadas por el cliente → texto para guardar, o null si no son válidas
export const parsePermissions = (value) => {
  if (!Array.isArray(value) || !value.length || value.length > STORE_PERMISSIONS.length) return null;
  if (!value.every((item) => STORE_PERMISSIONS.includes(item))) return null;
  const unique = STORE_PERMISSIONS.filter((item) => value.includes(item));
  return unique.join(',');
};

export const roleAllows = (role, permission) => {
  const list = permissionsOf(role);
  return list.includes(permission) || (permission === 'stock' && list.includes('folders'));
};

// ¿Puede actorId actuar sobre la tienda storeId con este permiso? El dueño siempre puede.
export const canActForStore = async (db, actorId, storeId, permission) => {
  if (!actorId || !storeId) return false;
  if (actorId === storeId) return true;
  const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId, userId: actorId } }, select: { role: true, status: true } });
  if (!member || member.status !== 'active' || !roleAllows(member.role, permission)) return false;
  return Boolean((await getEffectivePlan(db, storeId)).plan.storeTools);
};
