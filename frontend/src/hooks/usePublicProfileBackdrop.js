import { useEffect } from 'react';

// Fondo del sitio con el estilo de un perfil público: color de la página, color de la barra del navegador del celular y fondo propio.
export default function usePublicProfileBackdrop({ enabled = true, surface, primary, wallpaper }) {
  useEffect(() => {
    if (!enabled) return undefined;
    document.body.classList.add('public-profile-active');

    const originalBodyBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = surface || '#1a2b4b';

    let metaThemeColor = document.querySelector('meta[name=theme-color]');
    let originalMetaColor = '';
    if (metaThemeColor) {
      originalMetaColor = metaThemeColor.getAttribute('content');
      metaThemeColor.setAttribute('content', primary || '#1a2b4b');
    } else {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      metaThemeColor.content = primary || '#1a2b4b';
      document.head.appendChild(metaThemeColor);
    }

    if (wallpaper) {
      document.documentElement.style.setProperty('--seller-bg', `url(${wallpaper})`);
      document.documentElement.style.setProperty('--seller-overlay', 'transparent');
    } else {
      document.documentElement.style.removeProperty('--seller-bg');
      document.documentElement.style.removeProperty('--seller-overlay');
    }

    return () => {
      document.body.classList.remove('public-profile-active');
      document.documentElement.style.removeProperty('--seller-bg');
      document.documentElement.style.removeProperty('--seller-overlay');
      document.body.style.backgroundColor = originalBodyBg;
      if (metaThemeColor) {
        if (originalMetaColor) metaThemeColor.setAttribute('content', originalMetaColor);
        else metaThemeColor.remove();
      }
    };
  }, [enabled, wallpaper, surface, primary]);
}
