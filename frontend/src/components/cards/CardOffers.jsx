import { Link } from 'react-router-dom';

const formatCLP = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value) || 0);

const LANGUAGES = { English: 'Inglés', Spanish: 'Español', Japanese: 'Japonés' };

function SellerAvatar({ user }) {
  const name = user?.name || user?.username || 'Vendedor';
  return user?.photoURL
    ? <img src={user.photoURL} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-11 w-11 shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-black/10" />
    : <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-base font-extrabold text-white">{name.charAt(0).toUpperCase()}</span>;
}

// Un vendedor de esta carta: quién es, cuánto pide y cuántas tiene. Lleva a su carpeta.
function OfferRow({ offer, isBest, isChosen }) {
  const user = offer.folder.user || {};
  const name = user.name || user.username || 'Vendedor';
  const hasPrice = Number(offer.price) > 0;
  return (
    <li className={`rounded-2xl bg-white p-3 ring-1 sm:p-4 ${isChosen ? 'ring-2 ring-[#1e40af]' : 'ring-slate-900/5'} shadow-[0_1px_2px_rgba(26,43,75,0.06)]`}>
      <div className="flex items-center gap-3">
        <SellerAvatar user={user} />
        <div className="min-w-0 flex-1">
          {user.username
            ? <Link to={`/${user.username}`} className="block truncate text-[15px] font-extrabold text-[#12315f] hover:underline focus:outline-none focus-visible:underline">{name}</Link>
            : <p className="truncate text-[15px] font-extrabold text-[#12315f]">{name}</p>}
          <p className="truncate text-xs text-slate-500">Carpeta {offer.folder.name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-lg font-black tabular-nums ${hasPrice ? 'text-[#12315f]' : 'text-slate-500'}`}>{hasPrice ? formatCLP(offer.price) : 'Consultar'}</p>
          <p className="text-xs font-bold tabular-nums text-slate-500">{offer.stock === 1 ? 'Última unidad' : `${offer.stock > 999 ? '999+' : offer.stock} disponibles`}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isBest && <span className="rounded-full bg-[#facc15] px-2.5 py-0.5 text-[11px] font-extrabold text-[#12315f]">Mejor precio</span>}
        {isChosen && <span className="rounded-full bg-[#dbeafe] px-2.5 py-0.5 text-[11px] font-extrabold text-[#1e40af]">La que tocaste</span>}
        {offer.language && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">{LANGUAGES[offer.language] || offer.language}</span>}
        <Link to={`/c/${offer.folder.id}`} className="ml-auto flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#1e40af] px-4 text-sm font-bold text-white transition-[background-color,transform] duration-150 hover:bg-[#12315f] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
          <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[20px]">folder_open</span>
          Ver carpeta del vendedor
        </Link>
      </div>
    </li>
  );
}

export default function CardOffers({ offers, chosenId }) {
  const best = offers.find((offer) => Number(offer.price) > 0);
  return (
    <section aria-labelledby="card-offers-title" className="mt-8">
      <h2 id="card-offers-title" className="text-xl font-extrabold text-[#12315f] md:text-2xl">Vendedores</h2>
      <p className="mt-0.5 text-sm text-slate-600">{offers.length === 1 ? '1 vendedor la tiene' : `${offers.length} vendedores la tienen`}, del precio más bajo al más alto.</p>
      <ul className="mt-4 space-y-2.5">
        {offers.map((offer) => <OfferRow key={offer.id} offer={offer} isBest={offer === best && offers.length > 1} isChosen={offer.id === chosenId} />)}
      </ul>
    </section>
  );
}
