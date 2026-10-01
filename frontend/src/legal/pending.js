import { TERMS_VERSION, PRIVACY_VERSION } from './versions';

// La casilla de los términos se marca ANTES de iniciar sesión. Como en ese momento todavía no hay cuenta,
// la aceptación queda anotada unos minutos en esta pestaña y se registra en el servidor apenas vuelve la sesión.
// Dura poco y se usa una sola vez: otra persona que entre después en el mismo navegador debe marcar la suya.
const KEY = 'carpetazo:terms-pending';
const MAX_AGE_MS = 10 * 60 * 1000;

export function markAcceptedBeforeLogin() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, at: Date.now() }));
  } catch (_error) { /* sin almacenamiento: aparecerá la pantalla de aceptación al ingresar */ }
}

export function clearPendingAcceptance() {
  try { sessionStorage.removeItem(KEY); } catch (_error) { /* nada que borrar */ }
}

// Devuelve true si había una aceptación reciente de las mismas versiones que rigen hoy. La borra siempre.
export function takePendingAcceptance(current) {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    sessionStorage.removeItem(KEY);
  } catch (_error) { return false; }
  return Boolean(saved && current
    && Date.now() - saved.at < MAX_AGE_MS
    && saved.termsVersion === current.termsVersion
    && saved.privacyVersion === current.privacyVersion);
}
