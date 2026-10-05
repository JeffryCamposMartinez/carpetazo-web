import { ContactIcon } from '../ContactIcon';
import { Link } from 'react-router-dom';
import { ReportMenu } from '../../moderation/ReportButton';
import { Stars } from '../../reviews/Reviews';
import { bannerForScreen } from '../../../utils/responsiveImage';

// Cifras grandes con separador de miles; desde 100.000 en formato corto para que nunca desborden
const formatCount = (value) => {
  const number = Number(value) || 0;
  return number >= 100000
    ? new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(number)
    : number.toLocaleString('es-CL');
};

// Portada de la carpeta pública: nombre, vendedor, contacto y cifras.
export default function CatalogCover({
  availableCardsCount, cards, contactSeller, folderData, isOwner, sellerData, totalStock,
  visibleContactOptions
}) {
  const messageOption = visibleContactOptions.find((contact) => contact.id === 'message');
  const socialOptions = visibleContactOptions.filter((contact) => contact.id !== 'message');
  const defaultAddress = sellerData?.addresses?.find((a) => a.isDefault) || sellerData?.addresses?.[0];
  const locationText = defaultAddress
    ? [defaultAddress.comuna, defaultAddress.region].filter(Boolean).join(', ')
    : [sellerData?.comuna, sellerData?.region].filter(Boolean).join(', ');
  const sellerPath = `/${sellerData?.username || folderData.userId}`;
  const socialClass = {
    whatsapp: 'text-green-600 hover:ring-green-300',
    instagram: 'text-pink-600 hover:ring-pink-300',
    facebook: 'text-blue-600 hover:ring-blue-300',
    youtube: 'text-red-600 hover:ring-red-300',
  };
  const stats = [
    { value: formatCount(cards.length), label: cards.length === 1 ? 'carta' : 'cartas' },
    { value: formatCount(availableCardsCount), label: 'con stock' },
    { value: formatCount(totalStock), label: totalStock === 1 ? 'copia' : 'copias' },
  ];
  return (
    <section className="relative mb-3 overflow-hidden rounded-[1.6rem] bg-[#0f2b57] text-white shadow-[0_22px_55px_-30px_rgba(15,23,42,0.8)] ring-1 ring-white/10 md:mb-5 md:rounded-[2rem]">
      {sellerData?.bannerBase64 && (
        <div className="absolute inset-0 z-0 opacity-45" style={{ backgroundImage: `url(${bannerForScreen(sellerData.bannerBase64)})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-[#0f2b57]/95 via-[#12315f]/85 to-[#1e40af]/70" />

      <div className="relative z-10 flex flex-col gap-2.5 p-3 md:gap-6 md:p-8">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="min-w-0 md:block">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 md:block">
            {folderData?.tcg && (
              <span className="order-2 inline-flex items-center rounded-full bg-white/12 px-2.5 py-0.5 text-xs font-bold text-blue-100 ring-1 ring-white/20 md:order-none md:px-3 md:py-1">{folderData.tcg}</span>
            )}
            <h1 className="order-1 break-words text-[1.7rem] font-black leading-[1.05] tracking-[-0.03em] md:order-none md:mt-2 md:text-5xl">{folderData.name}</h1>
            </div>

            <div className="mt-2 flex items-center gap-2.5 md:mt-4 md:gap-3">
              <Link to={sellerPath} className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border-2 border-[#facc15] bg-white shadow-lg transition-transform hover:scale-105 md:h-14 md:w-14" aria-label="Ver perfil del vendedor">
                {(sellerData?.avatarBase64 || sellerData?.photoURL) ? (
                  <img src={sellerData?.avatarBase64 || sellerData?.photoURL} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2b4b] to-[#3b82f6] text-xl font-black text-white">{(sellerData?.displayName || 'V')[0].toUpperCase()}</span>
                )}
              </Link>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Link to={sellerPath} className="truncate text-base font-extrabold hover:underline md:text-lg">{sellerData?.displayName || 'Vendedor anónimo'}</Link>
                  {sellerData?.reviewSummary?.showAverage ? (
                    <Link to={`${sellerPath}#resenas`} className="flex items-center gap-1.5 text-xs font-bold text-[#facc15] hover:underline" title="Ver reseñas">
                      <Stars value={sellerData.reviewSummary.average} size={14} />
                      {sellerData.reviewSummary.average.toFixed(1)} · {sellerData.reviewSummary.count} {sellerData.reviewSummary.count === 1 ? 'reseña' : 'reseñas'}
                    </Link>
                  ) : sellerData?.reviewSummary?.count > 0 ? (
                    <Link to={`${sellerPath}#resenas`} className="text-xs font-bold text-[#facc15] hover:underline" title="Ver reseñas">
                      {sellerData.reviewSummary.count} {sellerData.reviewSummary.count === 1 ? 'reseña' : 'reseñas'}
                    </Link>
                  ) : (
                    <Link to={`${sellerPath}#resenas`} className="text-xs font-semibold text-blue-200 hover:underline" title="Ver reseñas">Sin reseñas todavía</Link>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-blue-100">
                  {locationText && (
                    <span className="flex items-center gap-1">
                      <span translate="no" className="material-symbols-outlined text-[15px]">location_on</span>{locationText}
                    </span>
                  )}
                  <Link to={sellerPath} className="inline-flex min-h-6 items-center font-bold text-[#facc15] hover:underline">Ver más del vendedor</Link>
                </div>
              </div>
            </div>
            {sellerData?.bio && <p className="mt-3 hidden line-clamp-2 max-w-xl md:block border-l-2 border-[#facc15]/70 pl-3 text-sm italic text-blue-100">"{sellerData.bio}"</p>}
          </div>

          <div className="flex items-center gap-2 md:flex-wrap md:justify-end md:pt-1">
            {isOwner && (
              <Link
                to={`/carpeta/${folderData.id}`}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#facc15] px-4 py-2.5 text-sm font-extrabold text-[#12315f] shadow-md transition hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white/70 md:flex-none md:px-5"
              >
                <span translate="no" className="material-symbols-outlined text-[20px]">add_circle</span>
                <span className="md:hidden">Agregar cartas</span><span className="hidden md:inline">Agregar cartas a tu carpeta</span>
              </Link>
            )}
            {messageOption && (
              <button type="button" onClick={messageOption.onClick || contactSeller} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#facc15] px-4 py-2.5 text-sm font-extrabold text-[#12315f] shadow-md transition hover:-translate-y-0.5 hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-white/70 md:flex-none md:px-5">
                <ContactIcon type="message" className="h-4 w-4" />
                Contactar vendedor
              </button>
            )}
            {socialOptions.length > 0 && (
              <div className="flex items-center gap-2 md:justify-end md:gap-2.5">
              {socialOptions.map((contact) => (
                <a
                  key={contact.id}
                  href={contact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={contact.label}
                  title={contact.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-white/40 transition hover:-translate-y-0.5 hover:scale-105 ${socialClass[contact.id] || 'text-[#1a2b4b] hover:ring-[#facc15]'}`}
                >
                  <ContactIcon type={contact.id} className="h-5 w-5" />
                </a>
              ))}
              </div>
            )}
            {!isOwner && folderData?.id && (
              <ReportMenu label="Reportar" buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-blue-100 hover:bg-white/10" options={[{ targetType: 'folder', targetId: folderData.id, label: 'Reportar esta carpeta' }, { targetType: 'user', targetId: sellerData?.id, blockUserId: sellerData?.id, label: 'Reportar al vendedor' }]} />
            )}
            {!isOwner && visibleContactOptions.length === 0 && (
              <span className="text-xs font-semibold text-blue-200">Sin contacto público</span>
            )}
          </div>
        </div>

        <p className="text-xs font-bold tabular-nums text-blue-100 md:hidden">{stats.map((item) => `${item.value} ${item.label}`).join(' · ')}</p>

        <dl className="hidden grid-cols-3 divide-x divide-white/15 rounded-2xl bg-white/8 ring-1 ring-white/15 md:grid">
          {stats.map((item) => (
            <div key={item.label} className="min-w-0 px-2 py-1.5 text-center md:px-6 md:py-4">
              <dt className="sr-only">{item.label}</dt>
              <dd className="flex min-w-0 flex-col items-center gap-0.5 text-lg font-black tabular-nums leading-none md:block md:text-3xl">
                {item.value}
                <span className="text-[11px] font-bold text-blue-200 md:ml-1.5 md:text-sm">{item.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
