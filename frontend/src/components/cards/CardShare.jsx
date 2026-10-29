import { api } from '../../services/api';
import { useState } from 'react';
import { siteUrl } from '../../utils/siteUrl';
import SvgIcon from '../ui/SvgIcon';

// Íconos de marca (trazos simples, 24×24)
const ICONS = {
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
};

const BrandIcon = ({ name }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current"><path d={ICONS[name]} /></svg>
);

const TILE = 'group flex flex-col items-center gap-1.5 rounded-xl py-1 text-[11px] font-bold text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]';
const CIRCLE = 'flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm transition-[transform,filter] duration-150 group-active:scale-[0.92] [@media(hover:hover)]:group-hover:brightness-110';

// Compartir la carta: enlace para copiar y WhatsApp, Facebook, X o el menú nativo del celular.
// `children` va al pie de la tarjeta (el botón de reportar).
// `compact`: en el celular todo más pequeño (sin rótulos bajo los íconos); desde md es igual que siempre.
export default function CardShare({ cardId, shareUrl, name, message, showToast, children, compact = false }) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl ? siteUrl(shareUrl) : siteUrl(`/carta/${cardId}`);
  const shown = url.replace(/^https?:\/\//, '');
  // Mensaje que acompaña el enlace en todas las redes (la página puede pasar uno con el precio)
  const text = message || `Mira ${name} en Carpetazo`;
  const encodedUrl = encodeURIComponent(url);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      api.trackMetric('share_card');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      showToast('Enlace copiado', 'success');
    } catch (_error) {
      showToast('No se pudo copiar el enlace.', 'error');
    }
  };
  const nativeShare = () => { api.trackMetric('share_card'); return navigator.share({ title: name, text, url }).catch(() => {}); };
  // Facebook no deja escribir la publicación por enlace (solo toma `quote`, y a veces lo ignora): se copia el mensaje completo para pegarlo
  const onFacebook = () => {
    api.trackMetric('share_card');
    navigator.clipboard?.writeText(`${text}: ${url}`).then(() => showToast('Mensaje copiado: pégalo en tu publicación si no aparece', 'success')).catch(() => {});
  };

  const networks = [
    ['WhatsApp', 'whatsapp', `https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, 'bg-[#25D366]'],
    ['Facebook', 'facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodeURIComponent(text)}`, 'bg-[#1877F2]', onFacebook],
    ['X', 'x', `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodedUrl}`, 'bg-[#0f1419]'],
  ];

  return (
    <section aria-labelledby="share-title" className={`rounded-2xl bg-white shadow-[0_1px_2px_rgba(26,43,75,0.06)] ring-1 ring-slate-900/5 ${compact ? 'p-3 md:p-4' : 'p-4'}`}>
      <h2 id="share-title" className={`font-extrabold text-[#12315f] ${compact ? 'text-sm md:text-base' : 'text-base'}`}>Compartir esta carta</h2>

      <button type="button" onClick={copy} aria-label="Copiar enlace de la carta" className={`${compact ? 'mt-2 h-10 md:mt-3 md:h-12' : 'mt-3 h-12'} flex w-full items-center gap-2 rounded-xl bg-slate-50 pl-3 pr-1.5 text-left ring-1 ring-slate-200 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]`}>
        <SvgIcon name="link" translate="no" aria-hidden="true" className="text-[20px] text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{shown}</span>
        <span className={`flex ${compact ? 'h-8 md:h-9' : 'h-9'} shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-bold transition-colors ${copied ? 'bg-emerald-600 text-white' : 'bg-[#1e40af] text-white'}`}>
          <SvgIcon name={copied ? 'check' : 'content_copy'} translate="no" aria-hidden="true" className="text-[18px]" />
          {copied ? 'Copiado' : 'Copiar'}
        </span>
      </button>

      <div className={`grid grid-cols-4 gap-2 ${compact ? 'mt-2 md:mt-3' : 'mt-3'}`}>
        {networks.map(([label, icon, href, color, onClick]) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} aria-label={`Compartir en ${label}`} className={`${TILE} ${compact ? 'gap-0 md:gap-1.5' : ''}`}>
            <span className={`${CIRCLE} ${compact ? '!h-10 !w-10 md:!h-12 md:!w-12' : ''} ${color}`}><BrandIcon name={icon} /></span>
            <span className={compact ? 'hidden md:inline' : ''}>{label}</span>
          </a>
        ))}
        {typeof navigator !== 'undefined' && navigator.share ? (
          <button type="button" onClick={nativeShare} aria-label="Más opciones para compartir" className={`${TILE} ${compact ? 'gap-0 md:gap-1.5' : ''}`}>
            <span className={`${CIRCLE} ${compact ? '!h-10 !w-10 md:!h-12 md:!w-12' : ''} bg-slate-500`}><SvgIcon name="share" translate="no" aria-hidden="true" className="text-[24px]" /></span>
            <span className={compact ? 'hidden md:inline' : ''}>Más</span>
          </button>
        ) : null}
      </div>

      {children && <div className={`border-t border-slate-100 ${compact ? 'mt-2 pt-1 md:mt-3 md:pt-2' : 'mt-3 pt-2'}`}>{children}</div>}
    </section>
  );
}
