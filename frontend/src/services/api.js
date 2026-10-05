import { auth } from './firebase';

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
const listingCache = new Map(); // listados paginados: endpoint + consulta -> { at, json }
const clearPublicFoldersCache = () => { publicFoldersCache = null; searchCardsCache.clear(); listingCache.clear(); };

const listingShared = (endpoint, queryString = '') => {
  const key = endpoint + '?' + queryString;
  const hit = listingCache.get(key);
  if (hit && Date.now() - hit.at < PUBLIC_FOLDERS_TTL_MS) return Promise.resolve(hit.json);
  return apiFetch(endpoint + (queryString ? '?' + queryString : '')).then((json) => {
    if (listingCache.size >= 40) listingCache.delete(listingCache.keys().next().value);
    listingCache.set(key, { at: Date.now(), json });
    return json;
  });
};

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
    const error = new Error(errorData.message || errorData.error || 'Error: ' + response.status);
    error.status = response.status;
    error.code = errorData.code;
    // El servidor exige aceptar los Términos para escribir: la pantalla de aceptación se muestra sola
    if (errorData.code === 'terms_required') window.dispatchEvent(new Event('carpetazo:terms-required'));
    throw error;
  }

  // Cualquier cambio en carpetas, cartas o perfil invalida la copia de la lista pública
  if (options.method && options.method !== 'GET' && /^\/(folders|cards|users)/.test(endpoint)) clearPublicFoldersCache();

  return response.json();
};

// Descarga una imagen protegida (evidencias) como blob, con la sesión
export const apiBlob = async (endpoint) => {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const response = await fetch(apiUrl(endpoint), { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  if (!response.ok) throw new Error('Error: ' + response.status);
  return response.blob();
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
  getLegalVersions: () => apiFetch('/legal/versions'),
  acceptTerms: (data) => apiFetch('/users/me/accept-terms', { method: 'POST', body: JSON.stringify(data) }),
  declineTerms: () => apiFetch('/users/me/unaccepted', { method: 'DELETE' }),
  checkUsername: (username) => apiFetch('/users/username/check?username=' + encodeURIComponent(username || '')),
  checkUsernameAvailable: (username) => apiFetch('/users/username/available?username=' + encodeURIComponent(username || '')), // sin sesión, para el registro
  updateProfile: (data) => apiFetch('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  uploadImage: (formData) => apiFetch('/users/upload-image', { method: 'POST', body: formData, isMultipart: true }),
  deleteProfile: () => apiFetch('/users/me', { method: 'DELETE' }),
  
  // Folders
  getPublicFolders: () => getPublicFoldersShared(),
  searchFolders: (queryString = '') => listingShared('/folders/search', queryString),
  getSellers: (queryString = '') => listingShared('/sellers', queryString),
  getFeatured: () => listingShared('/home/featured'),
  getRecentCards: (limit = 12) => apiFetch('/cards/recent?limit=' + limit),
  searchCards: (queryString = '') => searchCardsShared(queryString),
  getSellerReviews: (username, page = 1) => apiFetch('/users/' + encodeURIComponent(username) + '/reviews?page=' + page),
  getPendingReviews: () => apiFetch('/reviews/pending'),
  createReview: (data) => apiFetch('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  reportReview: (id, reason) => apiFetch('/reviews/' + encodeURIComponent(id) + '/report', { method: 'POST', body: JSON.stringify({ reason }) }),
  getModerationReviews: () => apiFetch('/admin/reviews'),
  getReportReasons: (targetType) => apiFetch('/reports/reasons?targetType=' + encodeURIComponent(targetType)),
  createReport: (payload) => apiFetch('/reports', { method: 'POST', body: JSON.stringify(payload) }),
  getMyReports: () => apiFetch('/reports/mine'),
  getAdminReports: (params = {}) => apiFetch('/admin/reports?' + new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))),
  getAdminReport: (id) => apiFetch('/admin/reports/' + encodeURIComponent(id)),
  decideReport: (id, action, note, publicMessage) => apiFetch('/admin/reports/' + encodeURIComponent(id) + '/decision', { method: 'POST', body: JSON.stringify({ action, note, publicMessage }) }),
  noteReport: (id, note) => apiFetch('/admin/reports/' + encodeURIComponent(id) + '/note', { method: 'POST', body: JSON.stringify({ note }) }),
  getModerationAudit: (page = 1) => apiFetch('/admin/audit?page=' + page),
  getModerationMetrics: () => apiFetch('/admin/metrics'),
  getModerationSummary: () => apiFetch('/admin/summary'),
  getRetention: () => apiFetch('/admin/retention'),
  runRetention: () => apiFetch('/admin/retention/run', { method: 'POST', body: JSON.stringify({}) }),
  exportCase: (id, purpose, reference) => apiFetch('/admin/cases/' + encodeURIComponent(id) + '/export', { method: 'POST', body: JSON.stringify({ purpose, reference: reference || undefined }) }),
  getReportReasonsFor: (targetType, targetId) => apiFetch('/reports/reasons?targetType=' + encodeURIComponent(targetType) + '&targetId=' + encodeURIComponent(targetId)),
  uploadReportEvidence: (reportId, file) => { const formData = new FormData(); formData.append('image', file); return apiFetch('/reports/' + encodeURIComponent(reportId) + '/evidence', { method: 'POST', body: formData, isMultipart: true }); },
  getEvidenceBlob: (id) => apiBlob('/admin/evidence/' + encodeURIComponent(id)),
  getMyModeration: () => apiFetch('/me/moderation'),
  findMyOrderByCode: (code) => apiFetch('/me/orders/' + encodeURIComponent(code)),
  createAppeal: (payload) => apiFetch('/appeals', { method: 'POST', body: JSON.stringify(payload) }),
  respondToCase: (id, text) => apiFetch('/me/cases/' + encodeURIComponent(id) + '/response', { method: 'POST', body: JSON.stringify({ text }) }),
  getBlocks: () => apiFetch('/blocks'),
  blockUser: (userId) => apiFetch('/blocks', { method: 'POST', body: JSON.stringify({ userId }) }),
  unblockUser: (userId) => apiFetch('/blocks/' + encodeURIComponent(userId), { method: 'DELETE' }),
  getAdminCases: (params = {}) => apiFetch('/admin/cases?' + new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))),
  getAdminCase: (id) => apiFetch('/admin/cases/' + encodeURIComponent(id)),
  requestCaseResponse: (id) => apiFetch('/admin/cases/' + encodeURIComponent(id) + '/request-response', { method: 'POST', body: JSON.stringify({}) }),
  resolveCase: (id, payload) => apiFetch('/admin/cases/' + encodeURIComponent(id) + '/resolve', { method: 'POST', body: JSON.stringify(payload) }),
  getAdminSanctions: (status) => apiFetch('/admin/sanctions?status=' + (status || 'active')),
  getUserModeration: (username) => apiFetch('/admin/users/' + encodeURIComponent(username) + '/moderation'),
  applySanction: (username, payload) => apiFetch('/admin/users/' + encodeURIComponent(username) + '/sanctions', { method: 'POST', body: JSON.stringify(payload) }),
  approveSanction: (id) => apiFetch('/admin/sanctions/' + encodeURIComponent(id) + '/approve', { method: 'POST', body: JSON.stringify({}) }),
  revokeSanction: (id, note) => apiFetch('/admin/sanctions/' + encodeURIComponent(id) + '/revoke', { method: 'POST', body: JSON.stringify({ note }) }),
  // Evidencia legal de aceptación de Términos (solo administradores): correo e IP van en el cuerpo, nunca en la URL
  getTermsEvidence: (body) => apiFetch('/admin/terms/evidence', { method: 'POST', body: JSON.stringify(body) }),
  setStaffRole: (username, role) => apiFetch('/admin/users/' + encodeURIComponent(username) + '/role', { method: 'POST', body: JSON.stringify({ role }) }),
  getAdminAppeals: (status) => apiFetch('/admin/appeals?status=' + (status || 'open')),
  decideAppeal: (id, action, note) => apiFetch('/admin/appeals/' + encodeURIComponent(id) + '/decision', { method: 'POST', body: JSON.stringify({ action, note }) }),
  sendTestEmail: () => apiFetch('/admin/test-email', { method: 'POST', body: JSON.stringify({}) }),
  approveReview: (id) => apiFetch('/admin/reviews/' + encodeURIComponent(id) + '/approve', { method: 'POST' }),
  deleteReview: (id) => apiFetch('/admin/reviews/' + encodeURIComponent(id), { method: 'DELETE' }),
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
  saveFolderOrder: (id, ids) => apiFetch('/folders/' + id + '/order', { method: 'PUT', body: JSON.stringify({ ids }) }),
  updateFolder: (id, data) => apiFetch('/folders/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  
  // Cards
  addCard: (folderId, data) => apiFetch('/folders/' + folderId + '/cards', { method: 'POST', body: JSON.stringify(data) }),
  updateCard: (folderId, cardId, data) => apiFetch('/folders/' + folderId + '/cards/' + cardId, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCard: (folderId, cardId) => apiFetch('/folders/' + folderId + '/cards/' + cardId, { method: 'DELETE' }),
  updateCardsBulk: (folderId, updates) => apiFetch('/folders/' + folderId + '/cards-bulk', { method: 'PUT', body: JSON.stringify({ updates }) }),
  deleteCardsBulk: (folderId, ids) => apiFetch('/folders/' + folderId + '/cards-bulk/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  moveCardsBulk: (folderId, ids, targetFolderId) => apiFetch('/folders/' + folderId + '/cards-bulk/move', { method: 'POST', body: JSON.stringify({ ids, targetFolderId }) }),
  
  // Messages/Chats
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
  getMyOrders: () => apiFetch('/orders/mine'),
  getMyPendingOrders: (since) => apiFetch('/orders/mine/pending' + (since ? `?since=${encodeURIComponent(since)}` : '')),
  setMyOrderStatus: (id, status) => apiFetch('/orders/mine/' + id + '/status', { method: 'POST', body: JSON.stringify({ status }) }),
};

export default api;




