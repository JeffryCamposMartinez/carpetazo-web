import { auth } from '../firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
  syncUser: () => apiFetch('/users/sync', { method: 'POST' }),
  
  // Folders
  getPublicFolders: () => apiFetch('/folders'),
  getMyFolders: () => apiFetch('/folders/me'),
  getFolder: (id) => apiFetch('/folders/' + id),
  createFolder: (data) => apiFetch('/folders', { method: 'POST', body: JSON.stringify(data) }),
  deleteFolder: (id) => apiFetch('/folders/' + id, { method: 'DELETE' }),
  
  // Cards
  addCardToFolder: (folderId, data) => apiFetch('/folders/' + folderId + '/cards', { method: 'POST', body: JSON.stringify(data) }),
  deleteCard: (id) => apiFetch('/cards/' + id, { method: 'DELETE' }),
  
  // Messages
  getMyMessages: () => apiFetch('/messages/me'),
  sendMessage: (data) => apiFetch('/messages', { method: 'POST', body: JSON.stringify(data) }),
  markMessageRead: (id) => apiFetch('/messages/' + id + '/read', { method: 'PUT' }),
};
