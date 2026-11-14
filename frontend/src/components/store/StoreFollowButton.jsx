import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import SvgIcon from '../ui/SvgIcon';
import { useToast } from '../ui/ToastProvider';

// Seguir una tienda: avisos de sus eventos y ofertas (máximo uno al día)
export default function StoreFollowButton({ username }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getStoreFollow(username).then((r) => { if (alive) setState(r); }).catch(() => {});
    return () => { alive = false; };
  }, [username, currentUser]);

  if (!state?.available || state.isOwner) return state?.isOwner ? <span className="text-xs font-bold text-slate-500">{state.followers} {state.followers === 1 ? 'seguidor' : 'seguidores'}</span> : null;
  const toggle = async () => {
    if (!currentUser) { navigate('/bienvenida'); return; }
    setBusy(true);
    try {
      const r = state.following ? await api.unfollowStore(username) : await api.followStore(username);
      setState((s) => ({ ...s, following: r.following, followers: r.followers ?? Math.max(0, s.followers - 1) }));
      if (r.following) showToast('Ahora sigues esta tienda: te avisaremos de sus eventos y ofertas', 'success');
    } catch (error) { showToast(error.message || 'No se pudo completar', 'error'); } finally { setBusy(false); }
  };
  return (
    <button type="button" disabled={busy} aria-pressed={state.following} onClick={toggle} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-black transition active:scale-[0.97] disabled:opacity-60 ${state.following ? 'bg-blue-50 text-[#1e40af] ring-1 ring-[#1e40af]/30' : 'bg-[#1e40af] text-white hover:bg-[#12315f]'}`}>
      <SvgIcon name={state.following ? 'check' : 'add'} className="text-base" />{state.following ? 'Siguiendo' : 'Seguir tienda'} · {state.followers}
    </button>
  );
}
