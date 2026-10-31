import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../services/api';
import { warmFolderPreview } from '../../utils/sharePreview';
import { siteUrl } from '../../utils/siteUrl';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { BrandIcon } from '../cards/CardShare';
import SvgIcon from '../ui/SvgIcon';
import { ButtonSpinner } from '../ui/LoadingState';

const TILE = 'group flex flex-col items-center gap-1.5 rounded-xl py-1 text-[11px] font-bold text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]';
const CIRCLE = 'flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm transition-[transform,filter] duration-150 group-active:scale-[0.92] [@media(hover:hover)]:group-hover:brightness-110';
const BTN = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-bold transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2';

const slug = (text) => String(text || 'carpeta').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'carpeta';

// Código QR como trazado SVG (cada módulo oscuro es un cuadrado de 1×1); `margin` módulos blancos alrededor para que los lectores lo vean bien
const qrPath = (qr, margin) => {
  const count = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) path += `M${col + margin} ${row + margin}h1v1h-1z`;
  return { path, size: count + margin * 2 };
};

const wrapLines = (context, text, maxWidth, maxLines) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !line) line = next; else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')}…`; }
  return lines;
};

// Imagen para imprimir o subir a historias: nombre de la carpeta, QR grande y la dirección
const drawPoster = async (qr, name, url) => {
  const W = 1080;
  const H = 1540;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext('2d');
  context.fillStyle = '#12315f';
  context.fillRect(0, 0, W, H);
  context.fillStyle = '#facc15';
  context.fillRect(0, 0, W, 18);
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.font = '800 54px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.fillText('Carpetazo.cl', W / 2, 110);
  context.fillStyle = '#facc15';
  context.font = '800 76px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.fillText('Escanea y mira', W / 2, 250);
  context.fillText('mis cartas', W / 2, 335);
  context.fillStyle = '#ffffff';
  context.font = '700 52px system-ui, -apple-system, "Segoe UI", sans-serif';
  wrapLines(context, name, W - 200, 2).forEach((line, index) => context.fillText(line, W / 2, 430 + index * 62));
  const box = 760;
  const boxX = (W - box) / 2;
  const boxY = 540;
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.roundRect(boxX, boxY, box, box, 36);
  context.fill();
  const { path, size } = qrPath(qr, 2);
  const unit = (box - 40) / size;
  context.fillStyle = '#000000';
  context.save();
  context.translate(boxX + 20, boxY + 20);
  context.scale(unit, unit);
  context.fill(new Path2D(path));
  context.restore();
  context.fillStyle = '#ffffff';
  const address = url.replace(/^https?:\/\//, '');
  let fontPx = 38;
  context.font = `700 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  while (context.measureText(address).width > W - 120 && fontPx > 20) { fontPx -= 2; context.font = `700 ${fontPx}px system-ui, -apple-system, "Segoe UI", sans-serif`; } // la dirección siempre cabe
  context.fillText(address, W / 2, boxY + box + 95);
  context.fillStyle = '#93b4e8';
  context.font = '600 32px system-ui, -apple-system, "Segoe UI", sans-serif';
  context.fillText('El mercado de cartas TCG de Chile', W / 2, H - 65);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
};

// Compartir una carpeta: código QR (en pantalla y en imagen para imprimir), enlace, WhatsApp, Facebook, X y el menú del celular.
// Una carpeta privada no se ve con el enlace: primero se ofrece publicarla.
export default function FolderShareSheet({ folder, onClose, onPublished, onPdf, showToast }) {
  const [isPublic, setIsPublic] = useState(Boolean(folder.isPublic));
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const closeRef = useRef(null);
  useBodyScrollLock(true);
  const url = siteUrl(`/c/${folder.id}`);
  const shown = url.replace(/^https?:\/\//, '');
  const text = `Mira mi catálogo de cartas "${folder.name}" en Carpetazo`;
  const encodedUrl = encodeURIComponent(url);

  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  // La librería del QR pesa poco, pero solo se descarga al abrir esta hoja
  useEffect(() => {
    let live = true;
    import('qrcode-generator').then((module) => {
      const code = module.default(0, 'M');
      code.addData(url);
      code.make();
      if (live) setQr(code);
    }).catch(() => {});
    return () => { live = false; };
  }, [url]);
  useEffect(() => { if (isPublic) warmFolderPreview(folder.id); }, [isPublic, folder.id]);

  const svg = useMemo(() => (qr ? qrPath(qr, 2) : null), [qr]);

  const publish = async () => {
    setBusy('publish');
    try {
      await api.updateFolder(folder.id, { isPublic: true });
      setIsPublic(true);
      onPublished?.();
      showToast('Carpeta publicada', 'success');
    } catch (error) {
      showToast(error.message || 'No se pudo publicar la carpeta', 'error');
    }
    setBusy('');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      api.trackMetric('share_folder');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      showToast('Enlace copiado', 'success');
    } catch (_error) {
      showToast('No se pudo copiar el enlace.', 'error');
    }
  };
  const nativeShare = () => { api.trackMetric('share_folder'); return navigator.share({ title: `Catálogo de ${folder.name}`, text, url }).catch(() => {}); };
  const onFacebook = () => {
    api.trackMetric('share_folder');
    navigator.clipboard?.writeText(`${text}: ${url}`).then(() => showToast('Mensaje copiado: pégalo en tu publicación si no aparece', 'success')).catch(() => {});
  };
  const downloadQr = async () => {
    if (!qr) return;
    setBusy('qr');
    try {
      const blob = await drawPoster(qr, folder.name, url);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `qr-${slug(folder.name)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
      api.trackMetric('share_folder');
      showToast('Imagen con el QR descargada', 'success');
    } catch (_error) {
      showToast('No se pudo crear la imagen del QR.', 'error');
    }
    setBusy('');
  };

  const networks = [
    ['WhatsApp', 'whatsapp', `https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, 'bg-[#25D366]'],
    ['Facebook', 'facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(text)}`, 'bg-[#1877F2]', onFacebook],
    ['X', 'x', `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodedUrl}`, 'bg-[#0f1419]'],
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Compartir la carpeta ${folder.name}`} className="auth-sheet max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_18px_50px_-12px_rgba(8,18,42,0.55)] sm:rounded-3xl sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#facc15] text-[#12315f]">
            <SvgIcon name="qr_code_2" translate="no" aria-hidden="true" className="text-[26px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold leading-tight text-[#12315f]">Compartir carpeta</h2>
            <p className="truncate text-sm text-slate-600">{folder.name}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar" className="-mr-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-[background-color,transform] duration-150 hover:bg-slate-100 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
            <SvgIcon name="close" translate="no" aria-hidden="true" className="text-[22px]" />
          </button>
        </div>

        {!isPublic ? (
          <div className="mt-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="text-sm font-extrabold text-amber-900">Esta carpeta es privada</p>
            <p className="mt-1 text-sm text-amber-900/90">Quien escanee el QR o abra el enlace no vería tus cartas. Publícala para poder compartirla.</p>
            <button type="button" disabled={busy === 'publish'} onClick={publish} className={`${BTN} mt-3 bg-[#1e40af] text-white hover:bg-[#12315f]`}>
              {busy === 'publish' ? <ButtonSpinner /> : <SvgIcon name="public" translate="no" aria-hidden="true" className="text-[22px]" />}
              Publicar carpeta
            </button>
          </div>
        ) : (
          <>
            <div className="mx-auto mt-4 flex w-full max-w-[15.5rem] flex-col items-center rounded-2xl bg-white p-3 ring-1 ring-slate-900/10 shadow-[0_8px_24px_-16px_rgba(26,43,75,0.5)]">
              <div className="aspect-square w-full">
                {svg ? (
                  <svg viewBox={`0 0 ${svg.size} ${svg.size}`} role="img" aria-label={`Código QR de la carpeta ${folder.name}`} shapeRendering="crispEdges" className="h-full w-full"><rect width={svg.size} height={svg.size} fill="#fff" /><path d={svg.path} fill="#000" /></svg>
                ) : <div className="flex h-full w-full items-center justify-center rounded-lg bg-slate-50"><ButtonSpinner tone="dark" /></div>}
              </div>
              <p className="mt-1.5 text-center text-xs font-bold text-slate-500">Apunta la cámara del celular para abrir la carpeta</p>
            </div>

            <button type="button" onClick={copy} aria-label="Copiar enlace de la carpeta" className="mt-3 flex h-12 w-full items-center gap-2 rounded-xl bg-slate-50 pl-3 pr-1.5 text-left ring-1 ring-slate-200 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]">
              <SvgIcon name="link" translate="no" aria-hidden="true" className="text-[20px] text-slate-400" />
              <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{shown}</span>
              <span className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-bold transition-colors ${copied ? 'bg-emerald-600 text-white' : 'bg-[#1e40af] text-white'}`}>
                <SvgIcon name={copied ? 'check' : 'content_copy'} translate="no" aria-hidden="true" className="text-[18px]" />
                {copied ? 'Copiado' : 'Copiar'}
              </span>
            </button>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {networks.map(([label, icon, href, color, onClick]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" onClick={() => { if (onClick) onClick(); else api.trackMetric('share_folder'); }} aria-label={`Compartir en ${label}`} className={TILE}>
                  <span className={`${CIRCLE} ${color}`}><BrandIcon name={icon} /></span>
                  {label}
                </a>
              ))}
              {typeof navigator !== 'undefined' && navigator.share ? (
                <button type="button" onClick={nativeShare} aria-label="Más opciones para compartir" className={TILE}>
                  <span className={`${CIRCLE} bg-slate-500`}><SvgIcon name="share" translate="no" aria-hidden="true" className="text-[24px]" /></span>
                  Más
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <button type="button" disabled={!qr || busy === 'qr'} onClick={downloadQr} className={`${BTN} bg-[#facc15] text-[#12315f] hover:bg-[#eab308]`}>
                {busy === 'qr' ? <ButtonSpinner tone="dark" /> : <SvgIcon name="download" translate="no" aria-hidden="true" className="text-[22px]" />}
                Descargar QR para imprimir
              </button>
              {onPdf && (
                <button type="button" onClick={() => { onClose(); onPdf(); }} className={`${BTN} bg-white text-[#12315f] ring-1 ring-slate-300 hover:bg-slate-50`}>
                  <SvgIcon name="picture_as_pdf" translate="no" aria-hidden="true" className="text-[22px]" />
                  Descargar catálogo en PDF
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
