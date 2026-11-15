// Eventos que puede enviar la web (copia del catálogo del servidor, backend/core/analyticsCatalog.js: una prueba exige que coincidan).
// Los eventos del servidor (registro, carpeta creada, carta añadida, pedido, suscripción…) no se envían desde aquí.
export const WEB_EVENTS = [
  'page_view', 'page_leave', 'scroll_depth', 'web_vital', 'js_error', 'ui_click',
  'signup_started', 'login', 'login_failed',
  'form_started', 'form_completed', 'form_abandoned',
  'folder_viewed', 'folder_shared',
  'search', 'search_result_click', 'filter_used', 'card_viewed', 'card_shared',
  'scan_started', 'scan_succeeded', 'scan_failed',
  'cart_add', 'checkout_started',
  'plans_viewed', 'plan_checkout_started',
  'profile_viewed', 'store_followed', 'store_event_signup'
];
