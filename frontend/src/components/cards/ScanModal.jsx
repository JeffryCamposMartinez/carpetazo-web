import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import LiquidTabs from '../ui/LiquidTabs';
import SvgIcon from '../ui/SvgIcon';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import useEscape from '../../hooks/useEscape';
import useCardScanner, { quality, SCAN_GAMES } from '../../hooks/useCardScanner';
import { useAuth } from '../../contexts/AuthContext';

const GUIDE_COLOR = { '': '#ffcb05', scan: '#00d2ff', ok: '#34d399', mid: '#fb923c' };
const SAVED_GAME = 'carpetazo.scanGame';
const readGame = () => { try { const saved = localStorage.getItem(SAVED_GAME); return SCAN_GAMES.some((game) => game.value === saved) ? saved : 'all'; } catch (_error) { return 'all'; } };

// Apuntas la cámara a una carta, se detecta sola y se buscan las candidatas en el catálogo (motor de reconocimiento en el servidor).
// Las coincidencias son candidatas sin verificar: la impresión exacta puede variar.
export default function ScanModal({ onClose }) {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const areaRef = useRef(null);
  const guideRef = useRef(null);
  const [game, setGame] = useState(readGame);
  const games = useMemo(() => SCAN_GAMES.find((item) => item.value === game)?.ids || '', [game]);
  useBodyScrollLock();
  useEscape(true, onClose);
  const { message, guide, view, cameraError, reset } = useCardScanner({ videoRef, areaRef, guideRef, games, enabled: Boolean(currentUser) });

  const pickGame = (value) => { setGame(value); try { localStorage.setItem(SAVED_GAME, value); } catch (_error) { /* sin almacenamiento: no se recuerda el juego */ } };
  const best = view.result?.top?.[0];
  const q = view.result ? quality(view.result) : null;
  const color = GUIDE_COLOR[guide] || GUIDE_COLOR[''];
  const percent = best ? Math.max(0, Math.min(100, Math.round(((best.score - 0.4) / 0.6) * 100))) : 0;
  const search = best ? `/cartas?q=${encodeURIComponent([best.name, best.number].filter(Boolean).join(' '))}` : '/cartas';
  const corner = 'absolute h-[30px] w-[30px] transition-colors duration-200';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Buscar con la cámara" className="fixed inset-0 z-[1300] overflow-y-auto bg-[#071526] pb-[max(1.75rem,env(safe-area-inset-bottom))] text-slate-100" style={{ backgroundImage: 'radial-gradient(900px 420px at 85% -10%, rgba(255,203,5,.10), transparent 60%), radial-gradient(700px 380px at -10% 8%, rgba(59,130,246,.18), transparent 60%)' }}>
      <style>{'@keyframes scan-sweep{0%{top:3%}50%{top:96%}100%{top:3%}} @keyframes scan-rise{from{opacity:0;transform:translateY(10px)}}'}</style>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-sky-300/15 bg-[#071526]/90 px-4 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-md">
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight">Buscar con la cámara</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 transition-[background-color,transform] duration-150 hover:bg-white/20 active:scale-[0.94] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05]">
          <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[24px]" />
        </button>
      </header>

      <div className="mx-auto max-w-2xl px-3.5">
        <div ref={areaRef} className="relative mt-3 h-[52vh] min-h-[320px] overflow-hidden rounded-[30px] border border-sky-300/15 bg-[#02070f] shadow-[0_18px_50px_-18px_rgba(0,0,0,0.8)]">
          <video ref={videoRef} playsInline muted autoPlay className="block h-full w-full object-cover" />
          {currentUser && !cameraError && (
            <div ref={guideRef} className="pointer-events-none absolute left-1/2 top-1/2 aspect-[63/88] h-[84%] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-[0_0_0_999px_rgba(2,9,20,0.52)]">
              <span className={`${corner} -left-[3px] -top-[3px] rounded-tl-2xl border-l-4 border-t-4`} style={{ borderColor: color, filter: `drop-shadow(0 0 8px ${color})` }} />
              <span className={`${corner} -right-[3px] -top-[3px] rounded-tr-2xl border-r-4 border-t-4`} style={{ borderColor: color, filter: `drop-shadow(0 0 8px ${color})` }} />
              <span className={`${corner} -bottom-[3px] -left-[3px] rounded-bl-2xl border-b-4 border-l-4`} style={{ borderColor: color, filter: `drop-shadow(0 0 8px ${color})` }} />
              <span className={`${corner} -bottom-[3px] -right-[3px] rounded-br-2xl border-b-4 border-r-4`} style={{ borderColor: color, filter: `drop-shadow(0 0 8px ${color})` }} />
              <span className="absolute inset-0 overflow-hidden rounded-2xl">
                {guide === 'scan' && <span className="absolute inset-x-[6%] h-0.5 bg-gradient-to-r from-transparent via-[#00d2ff] to-transparent shadow-[0_0_18px_3px_rgba(0,210,255,0.55)]" style={{ animation: 'scan-sweep 1.35s ease-in-out infinite' }} />}
              </span>
            </div>
          )}
          {!currentUser && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-base font-bold">Inicia sesión para usar la cámara</p>
              <button type="button" onClick={() => { onClose(); navigate('/bienvenida'); }} className="h-11 rounded-full bg-[#ffcb05] px-6 text-sm font-extrabold text-[#1a1400] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Iniciar sesión</button>
            </div>
          )}
          {cameraError && <p role="alert" className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-semibold text-slate-200">{cameraError}</p>}
          {currentUser && !cameraError && (
            <div role="status" className="absolute bottom-3.5 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-sky-300/15 bg-[#071526]/75 px-3.5 py-2 text-sm font-semibold backdrop-blur-md">
              <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
              <span className="truncate">{message}</span>
            </div>
          )}
        </div>

        <LiquidTabs
          ariaLabel="Juego a buscar"
          layout="inline"
          options={SCAN_GAMES.map((item) => ({ value: item.value, label: item.label }))}
          value={game}
          onChange={pickGame}
          className="mt-3.5 gap-0.5 overflow-x-auto rounded-2xl border border-sky-300/15 bg-[#0d1e3a] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          buttonClassName="shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[13px] font-semibold"
          indicatorClassName="rounded-xl border-b-[3px] border-[#b88f00] bg-gradient-to-b from-[#ffd84a] to-[#ffcb05] shadow-[0_6px_18px_-6px_rgba(255,203,5,0.55)]"
          activeTextClassName="text-[#1a1400]"
          inactiveTextClassName="text-slate-400 hover:text-slate-200"
        />

        {!best ? (
          <div className="mt-4 rounded-[22px] border border-dashed border-sky-300/15 bg-[#0d1e3a]/50 px-5 py-6 text-center text-slate-400">
            <b className="mb-1 block text-[17px] text-slate-100">Apunta a una carta</b>
            Se detecta y se busca sola.
          </div>
        ) : (
          <>
            <section className="relative mt-4 overflow-hidden rounded-[26px] border border-[#ffcb05]/30 bg-gradient-to-br from-[#142e55]/95 to-[#0d1e3a]/95 p-4 shadow-[0_20px_50px_-22px_rgba(0,0,0,0.85)]" style={{ animation: 'scan-rise .35s cubic-bezier(.22,1,.36,1)' }}>
              <div className="flex gap-4">
                <div className="relative w-[42%] max-w-[190px] shrink-0">
                  {best.image ? <img src={best.image} alt="" referrerPolicy="no-referrer" className="relative z-10 block w-full rounded-[10px] shadow-[0_14px_28px_-10px_rgba(0,0,0,0.8)]" /> : <div className="flex aspect-[63/88] w-full items-center justify-center rounded-[10px] bg-[#02070f]"><SvgIcon name="style" translate="no" aria-hidden="true" className="text-[32px] text-slate-500" /></div>}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className={`self-start rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${view.done && q.ok ? 'bg-[#34d399] text-[#04261a]' : 'bg-[#fb923c] text-[#2a1200]'}`}>
                    {view.done ? (q.ok ? 'Probable' : 'Dudoso') : `Confirmando ${view.votes}/3`}
                  </span>
                  <h3 className="break-words text-xl font-bold leading-tight tracking-tight">{best.name}{best.number && <span className="font-semibold text-[#ffcb05]"> · {best.number}</span>}</h3>
                  <div className="flex flex-wrap gap-1.5 text-[11.5px] font-medium">
                    {best.lang && <span className="rounded-full border border-[#ffcb05]/30 bg-[#ffcb05]/10 px-2.5 py-1 text-[#ffcb05]">{best.lang}</span>}
                    {best.set && <span className="rounded-full border border-sky-300/15 bg-blue-500/15 px-2.5 py-1 text-blue-300">{best.set}</span>}
                    {best.rarity && <span className="rounded-full border border-sky-300/15 bg-blue-500/15 px-2.5 py-1 text-blue-300">{best.rarity}</span>}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-sky-300/10"><i className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-[#00d2ff]" style={{ width: `${percent}%` }} /></div>
                  <div className="flex justify-between text-[11.5px] text-slate-400"><span>similitud {best.score.toFixed(2)}</span><span>margen {q.margin.toFixed(2)}</span></div>
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2">
                <Link to={search} onClick={onClose} className="flex h-11 items-center gap-1.5 rounded-full bg-[#ffcb05] px-5 text-sm font-extrabold text-[#1a1400] transition-transform duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <SvgIcon name="search" translate="no" aria-hidden="true" className="text-[20px]" />Ver en Cartas
                </Link>
                {view.done && <button type="button" onClick={reset} className="flex h-11 items-center gap-1.5 rounded-full border border-white/30 px-5 text-sm font-extrabold text-white transition-[background-color,transform] duration-150 hover:bg-white/10 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffcb05]">Escanear otra</button>}
              </div>
            </section>

            {view.result.top.length > 1 && (
              <>
                <h3 className="mx-0.5 mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Otras candidatas</h3>
                <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-0.5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {view.result.top.slice(1).map((item) => (
                    <li key={`${item.categoryId}-${item.productId}`} className="w-32 shrink-0 snap-start rounded-2xl border border-sky-300/15 bg-[#0d1e3a] p-2">
                      {item.image ? <img src={item.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="block aspect-[63/88] w-full rounded-lg bg-[#02070f] object-cover" /> : <div className="aspect-[63/88] w-full rounded-lg bg-[#02070f]" />}
                      <p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight">{item.name}</p>
                      <small className="mt-0.5 block text-[10.5px] font-medium text-slate-400">{item.lang} · {item.score.toFixed(2)}</small>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        <p className="mx-1 mt-5 text-center text-[11px] text-slate-500">Candidatas del catálogo de Carpetazo, sin verificar. La impresión exacta puede variar.</p>
      </div>
    </div>,
    document.body
  );
}
