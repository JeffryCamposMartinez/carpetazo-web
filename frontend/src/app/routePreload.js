// Carga de cada pantalla. Las pantallas se descargan al visitarlas (lazy); aquí también se pueden descargar antes,
// para que al tocar una sección del menú el cambio sea inmediato y no espere la red.
import { api } from '../services/api';

// Si la red o el servidor tardan un instante al saltar de página, reintenta una vez antes de dar por caída la pantalla
const retryImport = (loader) => () =>
  loader().catch(
    () => new Promise((resolve, reject) => {
      setTimeout(() => loader().then(resolve, reject), 250);
    })
  );

export const pageLoaders = {
  landing: retryImport(() => import('../pages/LandingPage')),
  dashboard: retryImport(() => import('../pages/Dashboard')),
  explore: retryImport(() => import('../pages/ExplorePage')),
  folder: retryImport(() => import('../pages/FolderPage')),
  catalog: retryImport(() => import('../pages/PublicCatalog')),
  seller: retryImport(() => import('../pages/SellerProfile')),
  profile: retryImport(() => import('../pages/ProfilePage')),
  messages: retryImport(() => import('../pages/Messages')),
  moderation: retryImport(() => import('../pages/Moderation')),
  feedback: retryImport(() => import('../pages/FeedbackPage')),
  plans: retryImport(() => import('../pages/PlansPage')),
  folders: retryImport(() => import('../pages/FoldersPage')),
  cards: retryImport(() => import('../pages/CardsPage')),
  cardDetail: retryImport(() => import('../pages/CardDetailPage')),
  catalogCard: retryImport(() => import('../pages/CatalogCardPage')),
  sellers: retryImport(() => import('../pages/SellersPage')),
  legal: retryImport(() => import('../pages/LegalPage')),
  notFound: retryImport(() => import('../pages/NotFound')),
};

const loaderByPath = {
  '/': 'explore',
  '/carpetas': 'folders',
  '/cartas': 'cards',
  '/vendedores': 'sellers',
  '/bienvenida': 'landing',
  '/dashboard': 'dashboard',
  '/mensajes': 'messages',
  '/sugerencias': 'feedback',
  '/planes': 'plans',
};

const started = new Set();

// Descarga la pantalla de una ruta una sola vez; si falla se puede reintentar más adelante
export const preloadRoute = (path) => {
  const key = loaderByPath[path];
  if (!key || started.has(key)) return;
  started.add(key);
  pageLoaders[key]().catch(() => started.delete(key));
};

// Datos públicos de cada sección: quedan listos en memoria antes de que la pantalla los pida
const prefetchSectionData = () => {
  api.getFeatured().catch(() => {}); // portada
  api.searchFolders('').catch(() => {}); // Carpetas (primera página)
  api.getSellers('').catch(() => {}); // Vendedores (primera página)
  api.searchCards('').catch(() => {}); // Cartas (primera página)
};

// Al tocar el menú se descargan ya las cuatro secciones y sus datos (no hace nada si ya están)
export const preloadMainNow = () => {
  ['/', '/carpetas', '/cartas', '/vendedores'].forEach(preloadRoute);
  prefetchSectionData();
};

// Secciones del menú principal: se descargan cuando el navegador está libre, sin competir con la primera carga
export const preloadMainSections = () => {
  const run = preloadMainNow;
  if (typeof window === 'undefined') return undefined;
  // Celular o "ahorro de datos": no se adelanta nada; el menú las descarga al tocarlo (preloadMainNow)
  if (window.matchMedia('(max-width: 767px)').matches || navigator.connection?.saveData) return undefined;
  const timer = window.setTimeout(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 });
    else run(); // Safari de iPhone no tiene requestIdleCallback
  }, 1200);
  return () => window.clearTimeout(timer);
};
