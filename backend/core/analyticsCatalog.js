// Catálogo central de eventos de Carpetazo Intelligence. Un evento que no está aquí se rechaza.
// La web usa una copia idéntica en frontend/src/analytics/eventCatalog.js (una prueba exige que coincidan).
// Cada propiedad: 'str:N' (texto de hasta N caracteres, sin saltos), 'num' (número finito), 'bool' o ['a','b'] (lista cerrada).
// Nunca se admiten contraseñas, tokens, correos, teléfonos, direcciones ni contenido de mensajes: las propiedades son solo las listadas.
export const GAMES = ['pokemon', 'magic', 'yugioh', 'onepiece', 'lorcana', 'digimon', 'riftbound', 'myl', 'otro'];
const PLAN = ['free', 'enthusiast', 'premium', 'pro', 'store'];
const FORM = ['signup', 'folder', 'card', 'profile', 'verification', 'feedback', 'checkout', 'store', 'search', 'otro'];

export const EVENTS = {
  // Navegación (web)
  page_view: { origin: 'web', props: { title: 'str:80' } },
  page_leave: { origin: 'web', props: { sec: 'num', maxScroll: 'num' } },
  scroll_depth: { origin: 'web', props: { pct: [25, 50, 75, 100] } },
  web_vital: { origin: 'web', props: { name: ['LCP', 'INP', 'CLS', 'TTFB', 'FCP'], value: 'num', rating: ['good', 'needs-improvement', 'poor'] } },
  js_error: { origin: 'web', props: { message: 'str:120', source: 'str:80' } },
  ui_click: { origin: 'web', props: { id: 'str:40', area: 'str:30' } },
  // Cuenta
  signup_started: { origin: 'web', props: { method: ['google', 'email'] } },
  signup_completed: { origin: 'server', props: {} },
  login: { origin: 'web', props: { method: ['google', 'email'] } },
  login_failed: { origin: 'web', props: { method: ['google', 'email'], reason: 'str:40' } },
  // Formularios
  form_started: { origin: 'web', props: { form: FORM } },
  form_completed: { origin: 'web', props: { form: FORM, sec: 'num' } },
  form_abandoned: { origin: 'web', props: { form: FORM, sec: 'num' } },
  // Carpetas y cartas
  folder_created: { origin: 'server', props: { game: GAMES, isPublic: 'bool' } },
  folder_viewed: { origin: 'web', props: { game: GAMES, own: 'bool' } },
  folder_shared: { origin: 'web', props: { channel: ['link', 'qr', 'whatsapp', 'otro'] } },
  card_added: { origin: 'server', props: { game: GAMES, via: ['search', 'scan', 'csv', 'bulk', 'otro'], qty: 'num' } },
  card_removed: { origin: 'server', props: { game: GAMES } },
  // Búsqueda y catálogo
  search: { origin: 'web', props: { game: GAMES, results: 'num', ms: 'num', filters: 'num', scope: ['catalogo', 'ofertas', 'encabezado', 'carpeta'] } },
  search_result_click: { origin: 'web', props: { game: GAMES, rank: 'num' } },
  filter_used: { origin: 'web', props: { filter: 'str:30', scope: 'str:20' } },
  card_viewed: { origin: 'web', props: { game: GAMES } },
  card_shared: { origin: 'web', props: { game: GAMES, channel: ['link', 'whatsapp', 'otro'] } },
  wishlist_item_added: { origin: 'server', props: { game: GAMES } },
  // Escáner
  scan_started: { origin: 'web', props: { mode: ['agregar', 'buscar'] } },
  scan_succeeded: { origin: 'web', props: { mode: ['agregar', 'buscar'], ms: 'num', reads: 'num' } },
  scan_failed: { origin: 'web', props: { mode: ['agregar', 'buscar'], reason: 'str:40' } },
  // Pedidos
  cart_add: { origin: 'web', props: { game: GAMES } },
  checkout_started: { origin: 'web', props: { via: ['whatsapp', 'mensaje', 'retiro'] } },
  order_created: { origin: 'server', props: { via: ['whatsapp', 'mensaje', 'retiro'], items: 'num', coupon: 'bool' } },
  // Planes
  plans_viewed: { origin: 'web', props: {} },
  plan_checkout_started: { origin: 'web', props: { plan: PLAN } },
  subscription_confirmed: { origin: 'server', props: { plan: PLAN } },
  subscription_canceled: { origin: 'server', props: { plan: PLAN } },
  // Perfiles y tienda
  profile_viewed: { origin: 'web', props: { own: 'bool', isStore: 'bool' } },
  store_followed: { origin: 'web', props: {} },
  store_event_signup: { origin: 'web', props: {} },
  pickup_reserved: { origin: 'server', props: {} },
  message_sent: { origin: 'server', props: {} },
  // Técnico (servidor)
  api_error: { origin: 'server', props: { status: 'num', route: 'str:80' } },
};

export const EVENT_NAMES = Object.keys(EVENTS);

const clean = (value, spec) => {
  if (Array.isArray(spec)) return spec.includes(value) ? value : undefined;
  if (spec === 'num') return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 1000) / 1000 : undefined;
  if (spec === 'bool') return typeof value === 'boolean' ? value : undefined;
  if (typeof spec === 'string' && spec.startsWith('str:')) {
    if (typeof value !== 'string') return undefined;
    const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, Number(spec.slice(4)));
    return /@|https?:\/\/|\d{7,}/.test(text) ? undefined : text; // sin correos, enlaces ni números largos (teléfonos, RUT, tarjetas)
  }
  return undefined;
};

// Deja solo las propiedades permitidas del evento, con su tipo correcto
export const cleanProps = (name, props) => {
  const spec = EVENTS[name]?.props || {};
  const out = {};
  if (props && typeof props === 'object' && !Array.isArray(props)) {
    for (const [key, rule] of Object.entries(spec)) {
      const value = clean(props[key], rule);
      if (value !== undefined) out[key] = value;
    }
  }
  return out;
};

// «Pokemon», «Mitos y Leyendas», «YuGiOh»… -> clave estable del catálogo
export const gameKey = (value) => {
  const t = String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  if (t.includes('poke')) return 'pokemon';
  if (t.includes('mitos') || t === 'myl') return 'myl';
  if (t.includes('yugi')) return 'yugioh';
  if (t.includes('magic')) return 'magic';
  if (t.includes('onepiece')) return 'onepiece';
  for (const key of ['lorcana', 'digimon', 'riftbound']) if (t.includes(key)) return key;
  return 'otro';
};
