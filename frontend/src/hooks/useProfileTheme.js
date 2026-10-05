import { useMemo, useState } from 'react';
import { api } from '../services/api';
import { defaultPublicTheme, resolveSurfaceTheme, themeKey } from '../components/profile/profileStyles';

// Tema del perfil público: lo que se edita en el editor (se ve al instante) y lo guardado en la cuenta.
export default function useProfileTheme({ isOwner, seller, setSeller, showToast }) {
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const [themePanelTab, setThemePanelTab] = useState('theme');
  const [savingTheme, setSavingTheme] = useState(false);
  const [savedThemeJson, setSavedThemeJson] = useState('');

  const savedTheme = useMemo(() => ({
    ...defaultPublicTheme,
    ...(seller?.publicTheme && typeof seller.publicTheme === 'object' ? seller.publicTheme : {})
  }), [seller?.publicTheme]);
  const publicTheme = useMemo(() => resolveSurfaceTheme(savedTheme), [savedTheme]);
  const themeDirty = savedThemeJson !== '' && themeKey(savedTheme) !== savedThemeJson;

  // Al cargar el perfil: este es el tema guardado (para saber si hay cambios sin guardar)
  const markThemeSaved = (theme) => setSavedThemeJson(themeKey({ ...defaultPublicTheme, ...(theme && typeof theme === 'object' ? theme : {}) }));

  const handleThemeChange = async (theme) => {
    if (!isOwner) return;
    setSeller(prev => ({ ...prev, publicTheme: theme }));
    setSavingTheme(true);
    try {
      const response = await api.updateProfile({ publicTheme: theme });
      setSeller(prev => ({ ...prev, ...(response.user || {}), publicTheme: theme }));
      setSavedThemeJson(themeKey({ ...defaultPublicTheme, ...theme }));
    } catch (error) {
      console.error('Error saving public theme:', error);
      showToast('No se pudo guardar el tema.', 'error');
    } finally {
      setSavingTheme(false);
    }
  };

  const handleThemeFieldChange = (field, value) => {
    setSeller(prev => ({
      ...prev,
      publicTheme: {
        ...savedTheme,
        id: 'custom',
        name: 'Tema personalizado',
        [field]: value
      }
    }));
  };

  // Varios campos a la vez (una combinación de fuentes)
  const handleThemeFieldsChange = (fields) => {
    setSeller(prev => ({ ...prev, publicTheme: { ...savedTheme, id: 'custom', name: 'Tema personalizado', ...fields } }));
  };

  const applyThemePalette = (theme) => {
    setSeller(prev => ({
      ...prev,
      publicTheme: {
        ...savedTheme,
        id: theme.id,
        name: theme.name,
        primary: theme.primary,
        secondary: theme.secondary,
        accent: theme.accent,
        surface: theme.surface,
        card: theme.card,
        text: theme.text
      }
    }));
  };

  const resetPublicTheme = () => {
    setSeller(prev => ({
      ...prev,
      publicTheme: defaultPublicTheme
    }));
  };

  const saveCurrentTheme = () => handleThemeChange({
    ...savedTheme,
    id: publicTheme.id === 'custom' ? 'custom' : publicTheme.id,
    name: publicTheme.id === 'custom' ? 'Tema personalizado' : publicTheme.name
  });

  return {
    applyThemePalette, handleThemeFieldChange, handleThemeFieldsChange, markThemeSaved, publicTheme, resetPublicTheme,
    saveCurrentTheme, savedTheme, savingTheme, setThemePanelOpen, setThemePanelTab, themeDirty, themePanelOpen, themePanelTab
  };
}
