import { useState } from 'react';
import { updateProfile as updateFirebaseProfile } from 'firebase/auth';
import { api } from '../services/api';
import { getAverageRGB, getComplementaryHex } from '../utils/color';

// Fotos del perfil público (avatar, banner y fondo de página): se preparan en el navegador y se suben al servidor.
export default function useProfileImages({ currentUser, isOwner, refreshAppUser, setSeller, showToast }) {
  const [savingImage, setSavingImage] = useState(false);

  const compressImage = (file, type) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const rgb = type === 'banner' ? getAverageRGB(img, width, height) : null;
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('No se pudo preparar la imagen.'));
            return;
          }

          resolve({
            file: new File([blob], `${type}-${Date.now()}.webp`, { type: blob.type || 'image/webp' }),
            dominantColor: rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : null,
            complementaryColor: rgb ? getComplementaryHex(rgb.r, rgb.g, rgb.b) : null
          });
        }, 'image/webp', 1);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleImageUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file || !isOwner) return;
    if (!file.type.startsWith('image/')) return showToast('Sube una imagen válida.', 'error');
    if (file.size > 10 * 1024 * 1024) return showToast('La imagen es demasiado grande. Máximo 10 MB.', 'error');

    setSavingImage(true);
    try {
      const processedImage = await compressImage(file, type);

      const formData = new FormData();
      formData.append('image', processedImage.file);
      formData.append('type', type);

      const response = await api.uploadImage(formData);
      if (response.success && response.pending) {
        // Sin escaneo disponible y cuenta nueva: la imagen queda pendiente de revisión y no se muestra todavía
        const cleared = type === 'banner' ? { bannerBase64: null } : type === 'wallpaper' ? { wallpaperBase64: null } : { photoURL: null };
        setSeller(prev => ({ ...prev, ...cleared }));
        await refreshAppUser?.();
        showToast('Recibimos tu imagen. Queda pendiente de revisión y se mostrará cuando el equipo la apruebe.', { type: 'info', duration: 8000 });
      } else if (response.success) {
        const payload = type === 'banner'
          ? {
            bannerBase64: response.url,
            bannerDominantColor: response.dominantColor || processedImage.dominantColor,
            bannerComplementaryColor: response.complementaryColor || processedImage.complementaryColor
          }
          : type === 'wallpaper'
            ? { wallpaperBase64: response.url }
            : { photoURL: response.url };

        setSeller(prev => ({ ...prev, ...payload }));
        if (type === 'avatar') {
          try {
            await updateFirebaseProfile(currentUser, { photoURL: response.url });
          } catch (error) {
            console.warn('Firebase photo update skipped:', error);
          }
          await refreshAppUser?.();
        }
      } else {
        showToast(response.message || 'No se pudo subir la imagen.', 'error');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      showToast(error?.message || 'No se pudo guardar la imagen.', 'error');
    } finally {
      event.target.value = '';
      setSavingImage(false);
    }
  };

  return { handleImageUpload, savingImage };
}
