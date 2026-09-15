const fs = require('fs');

const content = import { auth } from '../firebase';

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
    headers['Authorization'] = \Bearer \\;
  }

  const response = await fetch(\\\\, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || \Error: \\);
  }

  return response.json();
};

export const api = {
  // Users
  syncUser: () => apiFetch('/users/sync', { method: 'POST' }),
  
  // Folders
  getPublicFolders: () => apiFetch('/folders'),
  getMyFolders: () => apiFetch('/folders/me'),
  getFolder: (id) => apiFetch(\/folders/\\),
  createFolder: (data) => apiFetch('/folders', { method: 'POST', body: JSON.stringify(data) }),
  deleteFolder: (id) => apiFetch(\/folders/\\, { method: 'DELETE' }),
  
  // Cards
  addCardToFolder: (folderId, data) => apiFetch(\/folders/\/cards\, { method: 'POST', body: JSON.stringify(data) }),
  deleteCard: (id) => apiFetch(\/cards/\\, { method: 'DELETE' }),
  
  // Messages
  getMyMessages: () => apiFetch('/messages/me'),
  sendMessage: (data) => apiFetch('/messages', { method: 'POST', body: JSON.stringify(data) }),
  markMessageRead: (id) => apiFetch(\/messages/\/read\, { method: 'PUT' }),
};
;

fs.writeFileSync('frontend/src/utils/api.js', content, 'utf8');
