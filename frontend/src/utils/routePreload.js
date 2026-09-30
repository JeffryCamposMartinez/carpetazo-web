// Carga de cada pantalla. Las pantallas se descargan al visitarlas (lazy); aquí también se pueden descargar antes,
// para que al tocar una sección del menú el cambio sea inmediato y no espere la red.
import { api } from './api';

export const pageLoaders = {
  landing: () => import('../pages/LandingPage'),
  dashboard: () => import('../pages/Dashboard'),
  explore: () => import('../pages/ExplorePage'),
  folder: () => import('../pages/FolderPokemon'),
  catalog: () => import('../pages/PublicCatalog'),
  seller: () => import('../pages/SellerProfile'),
  admin: () => import('../pages/AdminPanel'),
  profile: () => import('../pages/ProfilePage'),
  messages: () => import('../pages/Messages'),
  folders: () => import('../pages/FoldersPage'),
  cards: () => import('../pages/CardsPage'),
  sellers: () => import('../pages/SellersPage'),
  notFound: () => import('../pages/NotFound'),
};

const loaderByPath = {
  '/': 'explore',
  '/carpetas': 'folders',
  '/cartas': 'cards',
  '/vendedores': 'sellers',
  '/bienvenida': 'landing',
  '/dashboard': 'dashboard',
  '/mensajes': 'messages',
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
  api.getPublicFolders().catch(() => {}); // portada, Carpetas y Vendedores
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
  const timer = window.setTimeout(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 });
    else run(); // Safari de iPhone no tiene requestIdleCallback
  }, 1200);
  return () => window.clearTimeout(timer);
};
