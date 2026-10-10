import { apiUrl } from '../services/api';

// Al compartir el enlace de una carpeta se le pide al servidor su miniatura: así queda lista antes de que WhatsApp (u otro programa)
// la solicite y no se pierde por demorar unos segundos en armarse. No bloquea nada y, si falla, no importa.
export const warmFolderPreview = (folderId) => {
  if (!folderId) return;
  fetch(apiUrl(`/og/folder/${encodeURIComponent(folderId)}/image.jpg`)).catch(() => {});
};
