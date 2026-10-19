import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

// Plan vigente de la persona con sesión (límites y funciones). Una sola consulta por sesión; `reload` la repite tras un cambio de plan.
// `null` mientras carga o si no hay sesión: las pantallas deben dejar intentar y dejar que el servidor decida.
let cached = { key: null, plan: null };

export default function usePlan() {
  const { appUser } = useAuth() || {};
  const key = appUser?.id || null;
  const [plan, setPlan] = useState(() => (cached.key === key ? cached.plan : null));
  const load = useCallback(async () => {
    if (!key) { setPlan(null); return; }
    try {
      const response = await api.getBillingMe();
      cached = { key, plan: response.plan || null };
      setPlan(cached.plan);
    } catch {
      // sin plan conocido: no se bloquea nada en pantalla
    }
  }, [key]);
  useEffect(() => { if (cached.key === key && cached.plan) setPlan(cached.plan); else load(); }, [key, load]);
  return { plan, reload: load };
}
