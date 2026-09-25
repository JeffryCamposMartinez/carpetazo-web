import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.carpetazo.cl/api';

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
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const response = await fetch(API_BASE_URL + endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Error: ' + response.status);
  }

  return response.json();
};

export const api = {
  // Users
  syncUser: (data = {}) => apiFetch('/users/sync', { method: 'POST', body: JSON.stringify(data) }),
  getUserProfile: (username) => apiFetch('/users/' + username),
  getMe: () => apiFetch('/users/me'),
  updateProfile: (data) => apiFetch('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  deleteProfile: () => apiFetch('/users/me', { method: 'DELETE' }),
  
  // Folders
  getPublicFolders: () => apiFetch('/folders'),
  getMyFolders: () => apiFetch('/folders/me'),
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
  
  
  // TCG Proxy
  getTcgCategories: () => apiFetch('/tcg/categories'),
  getTcgGroups: (categoryId) => apiFetch('/tcg/' + categoryId + '/groups'),
  getTcgFilterOptions: (categoryId) => apiFetch('/tcg/' + categoryId + '/filter-options'),
  getTcgProductsMetadata: (ids = []) => apiFetch('/tcg/products/metadata', { method: 'POST', body: JSON.stringify({ ids }) }),
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
  updateOrder: (id, data) => apiFetch('/orders/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  getOrders: () => apiFetch('/orders'),
  getHistory: () => apiFetch('/history'),
  processOrder: (code) => apiFetch('/process-order', { method: 'POST', body: JSON.stringify({ code }) }),
  rejectOrder: (code) => apiFetch('/reject-order', { method: 'POST', body: JSON.stringify({ code }) }),
};

export default api;




