import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

// Sección de moderación (solo administradores). Por ahora está vacía: aquí llegarán los reportes.
// Pendiente: listar las reseñas reportadas (POST /api/reviews/:id/report las deja con counts=false y flag='reported')
// y permitir aprobarlas o eliminarlas. Mientras tanto se revisan con `node backend/review_moderation.cjs`.
export default function Moderation() {
  const { currentUser } = useAuth();
  const [state, setState] = useState('checking'); // checking | denied | ok

  useEffect(() => {
    if (!currentUser) { setState('denied'); return undefined; }
    let cancelled = false;
    api.get('/admin/me')
      .then((res) => { if (!cancelled) setState(res?.isAdmin ? 'ok' : 'denied'); })
      .catch(() => { if (!cancelled) setState('denied'); });
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  if (state === 'checking') {
    return <div className="flex flex-1 items-center justify-center py-20" role="status" aria-label="Verificando acceso"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1e40af] border-t-transparent" /></div>;
  }

  if (state === 'denied') {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <div className="rounded-3xl bg-white/95 p-8 shadow-xl ring-1 ring-slate-900/5">
          <h1 className="text-xl font-black text-[#12315f]">Acceso restringido</h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">Esta sección es solo para administradores.</p>
          <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-full bg-[#facc15] px-6 text-sm font-extrabold text-[#12315f]">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-3 sm:px-6 sm:py-6">
      <div className="rounded-[1.6rem] border border-white/70 bg-[#DBEAFE]/95 p-4 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.8)] md:rounded-[2rem] md:p-8">
        <header className="mb-5">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#12315f] md:text-4xl">Moderación</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">Revisión de contenido reportado por la comunidad.</p>
        </header>

        <section aria-label="Reportes de reseñas" className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-900/5">
          <span translate="no" className="material-symbols-outlined text-5xl text-[#1e40af]/40">flag</span>
          <h2 className="mt-2 text-lg font-extrabold text-[#12315f]">Reportes de reseñas</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Las reseñas que los usuarios reporten llegarán aquí para aprobarlas o eliminarlas. Por ahora esta sección está vacía.</p>
        </section>
      </div>
    </div>
  );
}
