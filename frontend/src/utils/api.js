import { auth } from '../firebase';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://api.carpetazo.cl/api').replace(/\/$/, '');

export const apiUrl = (endpoint = '') => {
  const normalizedEndpoint = String(endpoint).startsWith('/') ? endpoint : '/' + endpoint;
  return API_BASE_URL + normalizedEndpoint;
};

// La lista pública de carpetas se pide en la portada, en Carpetas y en Vendedores: se comparte un minuto para que
// cambiar de sección no espere la red. Cada quien recibe su propia copia (las pantallas modifican los datos).
const PUBLIC_FOLDERS_TTL_MS = 60 * 1000;
const searchCardsCache = new Map(); // consulta -> { at, json }
let publicFoldersCache = null; // { at, text }
let publicFoldersPending = null;
const clearPublicFoldersCache = () => { publicFoldersCache = null; searchCardsCache.clear(); };

const searchCardsShared = (queryString = '') => {
  const hit = searchCardsCache.get(queryString);
  if (hit && Date.now() - hit.at < PUBLIC_FOLDERS_TTL_MS) return Promise.resolve(hit.json);
  return apiFetch('/cards/search' + (queryString ? '?' + queryString : '')).then((json) => {
    if (searchCardsCache.size >= 20) searchCardsCache.delete(searchCardsCache.keys().next().value);
    searchCardsCache.set(queryString, { at: Date.now(), json });
    return json;
  });
};

/**
 * Función genérica para hacer peticiones al backend.
 * Automáticamente inyecta el token de Firebase.
 */
export const apiFetch = async (endpoint, options = {}) => {
  let token = null;
  
  if (auth.currentUser) {
    token = await auth.currentUser.getIdToken();
  }

  const headers = {
    ...(options.isMultipart ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const response = await fetch(apiUrl(endpoint), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Error: ' + response.status);
  }

  // Cualquier cambio en carpetas, cartas o perfil invalida la copia de la lista pública
  if (options.method && options.method !== 'GET' && /^\/(folders|cards|users)/.test(endpoint)) clearPublicFoldersCache();

  return response.json();
};

const getPublicFoldersShared = () => {
  if (publicFoldersCache && Date.now() - publicFoldersCache.at < PUBLIC_FOLDERS_TTL_MS) return Promise.resolve(JSON.parse(publicFoldersCache.text));
  if (!publicFoldersPending) {
    publicFoldersPending = apiFetch('/folders')
      .then((json) => { publicFoldersCache = { at: Date.now(), text: JSON.stringify(json) }; return publicFoldersCache.text; })
      .finally(() => { publicFoldersPending = null; });
  }
  return publicFoldersPending.then((text) => JSON.parse(text));
};

export const api = {
  get: (endpoint) => apiFetch(endpoint),
  post: (endpoint, data = {}) => apiFetch(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data = {}) => apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),

  // Users
  syncUser: (data = {}) => apiFetch('/users/sync', { method: 'POST', body: JSON.stringify(data) }),
  getUserProfile: (username) => apiFetch('/users/' + username),
  getMe: () => apiFetch('/users/me'),
  checkUsername: (username) => apiFetch('/users/username/check?username=' + encodeURIComponent(username || '')),
  updateProfile: (data) => apiFetch('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  uploadImage: (formData) => apiFetch('/users/upload-image', { method: 'POST', body: formData, isMultipart: true }),
  deleteProfile: () => apiFetch('/users/me', { method: 'DELETE' }),
  
  // Folders
  getPublicFolders: () => getPublicFoldersShared(),
  getRecentCards: (limit = 12) => apiFetch('/cards/recent?limit=' + limit),
  searchCards: (queryString = '') => searchCardsShared(queryString),
  getMyWishlist: () => apiFetch('/wishlist/me'),
  getWishlistMatches: () => apiFetch('/wishlist/matches'),
  addWishlistItem: (data) => apiFetch('/wishlist', { method: 'POST', body: JSON.stringify(data) }),
  updateWishlistItem: (id, data) => apiFetch('/wishlist/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(data) }),
  deleteWishlistItem: (id) => apiFetch('/wishlist/' + encodeURIComponent(id), { method: 'DELETE' }),
  getPublicWishlist: (username, page = 1) => apiFetch('/users/' + encodeURIComponent(username) + '/wishlist?page=' + page),
  getMyFolders: () => apiFetch('/folders/me'),
  getMyFolderStats: () => apiFetch('/folders/me/stats'),
  getFolder: (id) => apiFetch('/folders/' + id),
  createFolder: (data) => apiFetch('/folders', { method: 'POST', body: JSON.stringify(data) }),
  deleteFolder: (id) => apiFetch('/folders/' + id, { method: 'DELETE' }),
  updateFolder: (id, data) => apiFetch('/folders/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Cards
  addCard: (folderId, data) => apiFetch('/folders/' + folderId + '/cards', { method: 'POST', body: JSON.stringify(data) }),
  updateCard: (folderId, cardId, data) => apiFetch('/folders/' + folderId + '/cards/' + cardId, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCard: (folderId, cardId) => apiFetch('/folders/' + folderId + '/cards/' + cardId, { method: 'DELETE' }),
  
  // Messages/Chats
  getMyMessages: () => apiFetch('/messages/me'),
  getChats: () => apiFetch('/chats'),
  getMessages: (otherId) => apiFetch('/messages/' + otherId),
  sendMessage: (otherId, content) => apiFetch('/messages/' + otherId, { method: 'POST', body: JSON.stringify({ content }) }),
  markMessageRead: (id) => apiFetch('/messages/' + id + '/read', { method: 'PUT' }),
  setTyping: (otherId, isTyping) => apiFetch('/messages/' + otherId + '/typing', { method: 'POST', body: JSON.stringify({ isTyping }) }),
  getTyping: (otherId) => apiFetch('/messages/' + otherId + '/typing'),
  
  
  // TCG Proxy
  getTcgCategories: () => apiFetch('/tcg/categories'),
  getTcgGroups: (categoryId) => apiFetch('/tcg/' + categoryId + '/groups'),
  getTcgFilterOptions: (categoryId) => apiFetch('/tcg/' + categoryId + '/filter-options'),
  getTcgProductsMetadata: (ids = []) => apiFetch('/tcg/products/metadata', {
    method: 'POST',
    body: JSON.stringify({ ids: ids.filter(id => id !== undefined && id !== null).map(String) })
  }),
    getTcgBlocks: (categoryId) => apiFetch(categoryId ? `/tcg/blocks?categoryId=${categoryId}` : '/tcg/blocks'),
  getTcgPhysicalProducts: () => apiFetch('/tcg/physical-products'),
  getTcgProducts: (categoryId, groupId, mylFilters = {}) => {
    let qs = new URLSearchParams();
    if (mylFilters.type) qs.append('mylType', mylFilters.type);
    if (mylFilters.race) qs.append('mylRace', mylFilters.race);
    if (mylFilters.frequency) qs.append('mylFrequency', mylFilters.frequency);
    if (mylFilters.cost) qs.append('mylCost', mylFilters.cost);
      if (mylFilters.physicalProductId) qs.append('physicalProductId', mylFilters.physicalProductId);
    const qString = qs.toString() ? '?' + qs.toString() : '';
    return apiFetch('/tcg/' + categoryId + '/' + groupId + '/products' + qString);
  },
  searchTcgProducts: (query, categoryId, searchSet, mylFilters = {}) => {
    let qs = new URLSearchParams();
    if (query) qs.append('q', query);
    if (categoryId) qs.append('categoryId', categoryId);
    if (searchSet) qs.append('groupId', searchSet);
    if (mylFilters.blockId) qs.append('blockId', mylFilters.blockId);
    if (mylFilters.type) qs.append('mylType', mylFilters.type);
    if (mylFilters.race) qs.append('mylRace', mylFilters.race);
    if (mylFilters.frequency) qs.append('mylFrequency', mylFilters.frequency);
    if (mylFilters.cost) qs.append('mylCost', mylFilters.cost);
      if (mylFilters.physicalProductId) qs.append('physicalProductId', mylFilters.physicalProductId);
      return apiFetch('/tcg/search?' + qs.toString());
  },

  // Orders
  createOrder: (data) => apiFetch('/orders/create', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (id, data) => apiFetch('/orders/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  getMyOrders: () => apiFetch('/orders/mine'),
  getMyPendingOrders: (since) => apiFetch('/orders/mine/pending' + (since ? `?since=${encodeURIComponent(since)}` : '')),
  setMyOrderStatus: (id, status) => apiFetch('/orders/mine/' + id + '/status', { method: 'POST', body: JSON.stringify({ status }) }),
  getOrders: () => apiFetch('/orders'),
  getHistory: () => apiFetch('/history'),
  processOrder: (code) => apiFetch('/process-order', { method: 'POST', body: JSON.stringify({ code }) }),
  rejectOrder: (code) => apiFetch('/reject-order', { method: 'POST', body: JSON.stringify({ code }) }),
};

export default api;




