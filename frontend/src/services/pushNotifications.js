import { api } from './api';

// Notificaciones del navegador: registrar el trabajador de servicio y suscribir este dispositivo
export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyToBytes = (base64Url) => {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const registration = () => navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready);

// Suscripción de este dispositivo si ya existe (o null)
export const currentPushSubscription = async () => {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return reg ? reg.pushManager.getSubscription() : null;
};

// Pide permiso, suscribe este dispositivo y lo registra en el servidor. Lanza un Error con un mensaje para mostrar.
export const enablePush = async (publicKey) => {
  if (!pushSupported()) throw new Error('Tu navegador no admite notificaciones');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Las notificaciones están bloqueadas en este navegador. Actívalas desde el candado de la barra de direcciones.');
  const reg = await registration();
  const subscription = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  return api.subscribePush(subscription.toJSON());
};

export const disablePush = async () => {
  const subscription = await currentPushSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return api.unsubscribePush(endpoint);
};
