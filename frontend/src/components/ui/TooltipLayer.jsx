import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MARGIN = 10;
const SHOW_DELAY_MS = 350;
const WARM_MS = 500; // si acaba de cerrarse otro, el siguiente sale sin espera ni animación

// Un solo cuadro emergente para toda la web, con el estilo de Carpetazo: reemplaza al globo gris del navegador en cualquier elemento con `title`.
// Solo con mouse o teclado (en el celular no hay «pasar el cursor»). El `title` se guarda mientras el cuadro está visible y se devuelve al salir.
export default function TooltipLayer() {
  const [state, setState] = useState(null); // { el, text }
  const [place, setPlace] = useState(null); // { top, left, arrow, above }
  const [instant, setInstant] = useState(false);
  const bubble = useRef(null);
  const held = useRef(null); // { el, text } con el title retirado
  const timer = useRef(0);
  const closedAt = useRef(0);

  const release = useCallback(() => {
    clearTimeout(timer.current);
    const current = held.current;
    held.current = null;
    if (current) {
      current.el.removeAttribute('aria-describedby');
      if (current.el.isConnected && !current.el.hasAttribute('title')) current.el.setAttribute('title', current.text);
    }
    setState((open) => { if (open) closedAt.current = Date.now(); return null; });
  }, []);

  useEffect(() => {
    const start = (event) => {
      if (event.pointerType === 'touch' || !(event.target instanceof Element)) return;
      const el = event.target.closest('[title]');
      if (!el || el.hasAttribute('data-native-title') || el.closest('svg')) return;
      if (held.current?.el === el) return;
      const text = (el.getAttribute('title') || '').trim();
      if (!text) return;
      release();
      // Sin el title el navegador no muestra su globo; si el elemento no tenía otro nombre accesible, el texto pasa a aria-label
      if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && !el.textContent.trim()) el.setAttribute('aria-label', text);
      el.removeAttribute('title');
      held.current = { el, text };
      const warm = Date.now() - closedAt.current < WARM_MS;
      timer.current = setTimeout(() => { setInstant(warm); setState({ el, text }); }, warm ? 0 : SHOW_DELAY_MS);
    };
    const stop = (event) => {
      const current = held.current;
      if (current && !(event.relatedTarget instanceof Node && current.el.contains(event.relatedTarget))) release();
    };
    const onKey = (event) => { if (event.key === 'Escape') release(); };
    document.addEventListener('pointerover', start, true);
    document.addEventListener('focusin', (event) => { if (event.target instanceof Element && event.target.matches(':focus-visible')) start(event); }, true);
    document.addEventListener('pointerout', stop, true);
    document.addEventListener('focusout', stop, true);
    document.addEventListener('pointerdown', release, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', release, true);
    window.addEventListener('resize', release);
    return () => {
      document.removeEventListener('pointerover', start, true);
      document.removeEventListener('pointerout', stop, true);
      document.removeEventListener('focusout', stop, true);
      document.removeEventListener('pointerdown', release, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', release, true);
      window.removeEventListener('resize', release);
      release();
    };
  }, [release]);

  useEffect(() => {
    if (!state) { setPlace(null); return; }
    const { el } = state;
    if (!el.isConnected) { release(); return; }
    el.setAttribute('aria-describedby', 'carpetazo-tooltip');
    const rect = el.getBoundingClientRect();
    const width = Math.min(bubble.current?.offsetWidth || 160, window.innerWidth - MARGIN * 2);
    const height = bubble.current?.offsetHeight || 32;
    const above = rect.top - height - 12 > MARGIN;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, MARGIN), Math.max(window.innerWidth - width - MARGIN, MARGIN));
    const arrow = Math.min(Math.max(rect.left + rect.width / 2 - left, 14), Math.max(width - 14, 14));
    setPlace({ top: above ? rect.top - height - 9 : rect.bottom + 9, left, arrow, above });
  }, [state, release]);

  if (!state) return null;
  return createPortal(
    <div
      ref={bubble}
      id="carpetazo-tooltip"
      role="tooltip"
      style={{ top: place?.top ?? -999, left: place?.left ?? -999, visibility: place ? 'visible' : 'hidden' }}
      className={`tooltip-bubble ${place?.above === false ? 'is-below' : ''} ${instant ? 'is-instant' : ''} pointer-events-none fixed z-[310] w-max max-w-[min(18rem,calc(100vw-1.25rem))] rounded-lg bg-[#12315f] px-2.5 py-1.5 text-xs font-bold leading-snug text-white shadow-[0_10px_24px_-8px_rgba(8,18,42,0.65),0_0_0_1px_rgba(250,204,21,0.35)]`}
    >
      <span aria-hidden="true" className="absolute h-2.5 w-2.5 rotate-45 bg-[#12315f]" style={{ left: (place?.arrow ?? 20) - 5, [place?.above === false ? 'top' : 'bottom']: -4 }} />
      <span className="relative">{state.text}</span>
    </div>,
    document.body
  );
}
