import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const number = (value) => Number(value).toLocaleString('es-CL');

// Texto claro en español para cada tipo de error de un campo (reemplaza al globo gris del navegador)
export const validationMessage = (el) => {
  const v = el.validity;
  if (v.customError) return el.validationMessage;
  if (v.valueMissing) {
    if (el.type === 'checkbox') return 'Marca esta casilla para continuar';
    if (el.type === 'radio' || el.tagName === 'SELECT') return 'Elige una opción';
    if (el.type === 'file') return 'Selecciona un archivo';
    return 'Completa este campo';
  }
  if (v.typeMismatch) {
    if (el.type === 'email') return 'Escribe un correo válido, por ejemplo nombre@correo.com';
    if (el.type === 'url') return 'Escribe un enlace válido que empiece con https://';
    return 'El formato no es válido';
  }
  if (v.badInput) return 'Escribe un número válido';
  if (v.rangeUnderflow) {
    const min = Number(el.min);
    if (el.type !== 'number' && el.type !== 'range') return 'La fecha o la hora es demasiado antigua';
    if (min === 0) return 'No puede ser negativo';
    if (min === 1 && (!el.step || el.step === '1' || el.step === 'any' || Number.isInteger(Number(el.step)))) return 'El valor debe ser mayor que 0';
    return `El valor debe ser ${number(min)} o más`;
  }
  if (v.rangeOverflow) {
    if (el.type !== 'number' && el.type !== 'range') return 'La fecha o la hora es demasiado lejana';
    return `El valor debe ser ${number(el.max)} o menos`;
  }
  if (v.stepMismatch) return !el.step || el.step === '1' ? 'Escribe un número entero, sin decimales' : 'Escribe un valor válido';
  if (v.tooShort) return `Escribe al menos ${el.minLength} caracteres`;
  if (v.tooLong) return `Escribe como máximo ${el.maxLength} caracteres`;
  if (v.patternMismatch) return el.title || 'El formato no es válido';
  return el.validationMessage || 'Revisa este campo';
};

const MARGIN = 12;

// Un solo aviso de formulario para toda la web, con el estilo de Carpetazo: aparece junto al primer campo con error,
// lo enfoca, se va al escribir o salir del campo, y respeta «reducir movimiento».
export default function ValidationBubble() {
  const [state, setState] = useState(null); // { el, message }
  const [place, setPlace] = useState(null); // { top, left, arrow, above }
  const bubble = useRef(null);
  const firstInEvent = useRef(false);

  const hide = useCallback(() => setState((current) => { current?.el.removeAttribute('aria-invalid'); return null; }), []);

  useEffect(() => {
    const onInvalid = (event) => {
      const el = event.target;
      if (!(el instanceof HTMLElement) || el.hasAttribute('data-native-validation')) return;
      event.preventDefault(); // sin el globo del navegador
      if (firstInEvent.current) return; // al enviar el formulario llegan varios: solo se muestra el primero
      firstInEvent.current = true;
      setTimeout(() => { firstInEvent.current = false; }, 0);
      setState((current) => { current?.el.removeAttribute('aria-invalid'); return { el, message: validationMessage(el) }; });
      el.setAttribute('aria-invalid', 'true');
      el.focus({ preventScroll: true });
      const rect = el.getBoundingClientRect();
      if (rect.top < 80 || rect.bottom > window.innerHeight - 100) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    document.addEventListener('invalid', onInvalid, true);
    return () => document.removeEventListener('invalid', onInvalid, true);
  }, []);

  useEffect(() => {
    if (!state) { setPlace(null); return undefined; }
    const { el } = state;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!el.isConnected) { hide(); return; }
      const rect = el.getBoundingClientRect();
      const width = Math.min(bubble.current?.offsetWidth || 280, window.innerWidth - MARGIN * 2);
      const height = bubble.current?.offsetHeight || 52;
      const above = rect.bottom + height + 18 > window.innerHeight && rect.top - height - 18 > 0;
      const left = Math.min(Math.max(rect.left, MARGIN), Math.max(window.innerWidth - width - MARGIN, MARGIN));
      const arrow = Math.min(Math.max(rect.left + Math.min(rect.width / 2, 28) - left, 18), Math.max(width - 18, 18));
      setPlace({ top: above ? rect.top - height - 12 : rect.bottom + 12, left, arrow, above });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    schedule();
    const onKey = (event) => { if (event.key === 'Escape') hide(); };
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    document.addEventListener('keydown', onKey);
    el.addEventListener('input', hide);
    el.addEventListener('change', hide);
    el.addEventListener('blur', hide);
    const timer = setTimeout(hide, 7000);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('keydown', onKey);
      el.removeEventListener('input', hide);
      el.removeEventListener('change', hide);
      el.removeEventListener('blur', hide);
    };
  }, [state, hide]);

  if (!state) return null;
  return createPortal(
    <div
      ref={bubble}
      role="alert"
      style={{ top: place?.top ?? -999, left: place?.left ?? -999, visibility: place ? 'visible' : 'hidden' }}
      className={`validation-bubble pointer-events-none fixed z-[300] flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-2.5 rounded-xl bg-[#12315f] px-3 py-2.5 text-sm font-bold leading-snug text-white shadow-[0_14px_30px_-12px_rgba(18,49,95,0.75)] ring-1 ring-[#facc15]/60 ${place?.above ? 'is-above' : ''}`}
    >
      <span aria-hidden="true" className="absolute h-3 w-3 rotate-45 bg-[#12315f]" style={{ left: (place?.arrow ?? 24) - 6, [place?.above ? 'bottom' : 'top']: -5 }} />
      <span aria-hidden="true" className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f]"><span translate="no" className="material-symbols-outlined text-[16px]">priority_high</span></span>
      <span className="relative">{state.message}</span>
    </div>,
    document.body
  );
}
