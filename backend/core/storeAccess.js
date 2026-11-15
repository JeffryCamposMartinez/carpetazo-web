// Permisos de los empleados de una tienda. Único lugar donde se decide qué puede hacer cada rol:
//  - cashier: ventas en persona y retiros en tienda
//  - stock: cantidades y precios de las cartas
// Un empleado nunca ve datos bancarios, plan, ajustes, informes ni la ficha del local. Solo vale con el plan Tienda vigente del dueño.
import { getEffectivePlan } from './entitlements.js';

export const STORE_ROLES = ['cashier', 'stock'];
const PERMISSIONS = { cashier: ['sales', 'pickups'], stock: ['stock'] };

export const roleAllows = (role, permission) => Boolean(PERMISSIONS[role]?.includes(permission));

// ¿Puede actorId actuar sobre la tienda storeId con este permiso? El dueño siempre puede.
export const canActForStore = async (db, actorId, storeId, permission) => {
  if (!actorId || !storeId) return false;
  if (actorId === storeId) return true;
  const member = await db.storeMember.findUnique({ where: { storeId_userId: { storeId, userId: actorId } }, select: { role: true, status: true } });
  if (!member || member.status !== 'active' || !roleAllows(member.role, permission)) return false;
  return Boolean((await getEffectivePlan(db, storeId)).plan.storeTools);
};
