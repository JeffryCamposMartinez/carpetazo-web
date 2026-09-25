const fs = require('fs');

function replaceInFile(filepath, oldText, newText) {
    let content = fs.readFileSync(filepath, 'utf8');
    if (content.includes(oldText)) {
        content = content.replace(oldText, newText);
        fs.writeFileSync(filepath, content, 'utf8');
        console.log('Updated ' + filepath);
    } else {
        console.log('Could not find target text in ' + filepath);
    }
}

const sellerProfile = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/SellerProfile.jsx';
const profilePage = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/pages/ProfilePage.jsx';

const oldSeller =   const handleImageUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file || !isOwner) return;
    if (!file.type.startsWith('image/')) return alert('Sube una imagen válida.');
    if (file.size > 10 * 1024 * 1024) return alert('La imagen es demasiado grande. Máximo 10MB.');

    setSavingImage(true);
    try {
      const image = await compressImage(file, type);
      const payload = type === 'banner'
        ? {
          bannerBase64: image.base64,
          bannerDominantColor: image.dominantColor,
          bannerComplementaryColor: image.complementaryColor
        }
        : { photoURL: image.base64 };

      const response = await api.updateProfile(payload);
      setSeller(prev => ({ ...prev, ...(response.user || {}), ...payload }));
    } catch (error) {
      console.error('Error saving image:', error);
      alert('No se pudo guardar la imagen.');
    } finally {
      setSavingImage(false);
    }
  };;

const newSeller =   const handleImageUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file || !isOwner) return;
    if (!file.type.startsWith('image/')) return alert('Sube una imagen válida.');
    if (file.size > 10 * 1024 * 1024) return alert('La imagen es demasiado grande. Máximo 10MB.');

    setSavingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', type);

      const response = await api.uploadImage(formData);
      if (response.success) {
        const payload = type === 'banner'
          ? {
            bannerBase64: response.url,
            bannerDominantColor: response.dominantColor,
            bannerComplementaryColor: response.complementaryColor
          }
          : { photoURL: response.url };

        setSeller(prev => ({ ...prev, ...payload }));
      } else {
        alert(response.message || 'Error al subir la imagen');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      alert('No se pudo guardar la imagen.');
    } finally {
      setSavingImage(false);
    }
  };;

replaceInFile(sellerProfile, oldSeller, newSeller);

const oldProfile =   const handleAvatarUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return showFeedback('error', 'Sube una imagen válida.');
    if (file.size > 4 * 1024 * 1024) return showFeedback('error', 'La imagen debe pesar menos de 4 MB.');
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 420;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        updateProfileField('photoURL', canvas.toDataURL('image/webp', 0.72));
      };
      img.src = readerEvent.target.result;
    };
    reader.readAsDataURL(file);
  };;

const newProfile =   const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return showFeedback('error', 'Sube una imagen válida.');
    if (file.size > 10 * 1024 * 1024) return showFeedback('error', 'La imagen debe pesar menos de 10 MB.');
    
    showFeedback('info', 'Subiendo foto...');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', 'avatar');

      const response = await api.uploadImage(formData);
      if (response.success) {
        setProfileData(prev => ({ ...prev, photoURL: response.url }));
        showFeedback('success', 'Foto actualizada correctamente.');
      } else {
        showFeedback('error', response.message || 'Error al subir la imagen');
      }
    } catch (error) {
      console.error('Error saving image:', error);
      showFeedback('error', 'No se pudo subir la foto.');
    }
  };;

replaceInFile(profilePage, oldProfile, newProfile);
