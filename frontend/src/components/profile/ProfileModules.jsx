import { Link } from 'react-router-dom';
import ReviewsSection from '../reviews/Reviews';
import WishlistSection from '../wishlist/WishlistSection';
import { getCardStyle } from './profileStyles';
import { getFolderFilter } from '../../config/folderOptions';
import { readableOn } from '../../utils/color';

// Frase de la vitrina según su estilo
const SHOWCASE_LINES = {
  folders: 'Pequeñas cartas. Grandes historias.',
  collector: 'Una colección con historia.',
  seller: 'Tu próxima carta está aquí.',
};

// Módulos del perfil público: vitrina, carpetas, cartas deseadas y reseñas, en el orden y ancho de la distribución elegida.
export default function ProfileModules({
  avatarUrl, displayName, folders, getDistributionOrder, getDistributionSpan, getSocialEnabled, isOwner,
  profileLevel, publicTheme, seller, showProfileShowcase, spotlightFolders, textMuted, totalCards
}) {
  return (
    <main className="relative z-10 mx-auto w-full max-w-[1220px] px-4 py-6 sm:px-6 sm:py-8 md:px-8">
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
        {showProfileShowcase && (
          <section className={`min-w-0 border p-5 ring-1 ${getDistributionSpan('showcase')}`} style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: getDistributionOrder('showcase') }}>
            {/* Vitrina: una frase con el carácter elegido, las cifras reales y el nivel como sello */}
            <div className="mb-5 border-b pb-5" style={{ borderColor: `${publicTheme.primary}22` }}>
              <h2 className="max-w-[22ch] text-2xl font-black leading-[1.1] tracking-tight [text-wrap:balance] md:text-3xl" style={{ color: publicTheme.text }}>
                {SHOWCASE_LINES[publicTheme.showcaseStyle] || SHOWCASE_LINES.folders}
              </h2>
              <p className="mt-2 text-sm font-semibold tabular-nums" style={{ ...textMuted, fontFamily: 'var(--seller-data)' }}>
                {totalCards.toLocaleString('es-CL')} {totalCards === 1 ? 'carta' : 'cartas'} en {folders.length} {folders.length === 1 ? 'carpeta' : 'carpetas'}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-extrabold" style={{ backgroundColor: `${publicTheme.accent}40`, color: publicTheme.text }}>
                <span translate="no" aria-hidden="true" className="material-symbols-outlined text-[18px]" style={{ color: publicTheme.primary }}>military_tech</span>
                Coleccionista nivel <span style={{ fontFamily: 'var(--seller-data)' }}>{profileLevel}</span>
              </span>
            </div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <h3 className="text-base font-extrabold" style={{ color: publicTheme.text }}>
                {publicTheme.showcaseStyle === 'seller' ? 'Catálogo destacado' : publicTheme.showcaseStyle === 'collector' ? 'Colección destacada' : 'Carpetas favoritas'}
              </h3>
              <span className="text-sm font-bold tabular-nums" style={{ ...textMuted, fontFamily: 'var(--seller-data)' }}>{spotlightFolders.length} de {folders.length}</span>
            </div>
            <ul className="divide-y" style={{ borderColor: `${publicTheme.primary}22` }}>
              {spotlightFolders.map((folder) => (
                <li key={folder.id} style={{ borderColor: `${publicTheme.primary}22` }}>
                  <Link to={`/c/${folder.id}`} className="group flex items-center gap-3 py-3 focus:outline-none focus-visible:ring-2" style={{ color: publicTheme.text }}>
                    <span className="h-14 w-11 shrink-0 rounded-md bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat shadow-md" style={{ filter: getFolderFilter(folder.color) }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-extrabold">{folder.name}</span>
                      <span className="block truncate text-sm font-medium" style={textMuted}>{folder.tcg} · {folder.cardsCount} {folder.cardsCount === 1 ? 'carta' : 'cartas'}</span>
                    </span>
                    <span translate="no" className="material-symbols-outlined transition-transform group-hover:translate-x-1" style={{ color: publicTheme.primary }}>arrow_forward</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showProfileShowcase && (
          <section className={`min-w-0 border p-5 ring-1 ${getDistributionSpan('stats')}`} style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.accent}55`, order: getDistributionOrder('stats') }}>
            <h2 className="text-xl font-black leading-tight md:text-2xl" style={{ color: publicTheme.text }}>Resumen</h2>
            <dl className="mt-3 divide-y" style={{ borderColor: `${publicTheme.primary}22` }}>
              {[
                ['Carpetas públicas', folders.length, 'auto_stories'],
                ['Cartas mostradas', totalCards.toLocaleString('es-CL'), 'style'],
                ['Nivel del perfil', profileLevel, 'military_tech'],
              ].map(([label, value, icon]) => (
                <div key={label} className="flex items-center gap-3 py-3" style={{ borderColor: `${publicTheme.primary}22` }}>
                  <dt className="flex min-w-0 flex-1 items-center gap-3 text-sm font-semibold">
                    <span translate="no" aria-hidden="true" className="material-symbols-outlined shrink-0 text-[24px]" style={{ color: publicTheme.primary }}>{icon}</span>
                    <span style={textMuted}>{label}</span>
                  </dt>
                  <dd className="text-xl font-black tabular-nums" style={{ color: publicTheme.text, fontFamily: 'var(--seller-data)' }}>{value}</dd>
                </div>
              ))}
            </dl>
            <details className="mt-1 text-sm" style={{ color: publicTheme.text }}>
              <summary className="cursor-pointer py-2 font-bold" style={{ color: publicTheme.primary }}>¿Cómo se calcula el nivel?</summary>
              <ul className="list-disc space-y-1 pl-5 pb-1 font-medium" style={textMuted}>
                <li>+2 niveles por cada carpeta pública.</li>
                <li>+1 nivel por cada 12 cartas subidas.</li>
                <li>Todos empiezan en el nivel 1.</li>
              </ul>
            </details>
          </section>
        )}

        <section className={`min-w-0 space-y-5 ${getDistributionSpan('folders')}`} style={{ order: getDistributionOrder('folders') }}>
          <div className="flex items-center justify-between gap-3 p-4 ring-1 md:px-5" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33` }}>
            <div className="min-w-0">
              <h2 className="text-2xl font-black leading-tight" style={{ color: publicTheme.text }}>Carpetas públicas</h2>
              <p className="text-sm font-medium" style={textMuted}>Catálogos publicados por este vendedor.</p>
            </div>
            <span className="shrink-0 rounded-full px-3 py-1 text-sm font-extrabold tabular-nums" style={{ backgroundColor: publicTheme.primary, color: readableOn(publicTheme.primary), fontFamily: 'var(--seller-data)' }}>{folders.length}</span>
          </div>

          {folders.length === 0 ? (
            <div className="border border-dashed p-10 text-center" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}55` }}>
              <span translate="no" className="material-symbols-outlined text-5xl" style={{ color: `${publicTheme.primary}99` }}>inventory_2</span>
              <p className="mt-3 text-lg font-extrabold" style={{ color: publicTheme.text }}>{isOwner ? 'Aún no tienes carpetas públicas' : 'Este vendedor está ordenando sus cartas'}</p>
              <p className="mt-1 text-sm font-medium" style={textMuted}>{isOwner ? 'Crea una carpeta en tu panel y márcala como pública para que aparezca aquí.' : 'Cuando publique una carpeta, aparecerá aquí.'}</p>
              {isOwner && <Link to="/dashboard" className="mt-4 inline-flex h-11 items-center rounded-full px-6 text-sm font-extrabold" style={{ backgroundColor: publicTheme.primary, color: readableOn(publicTheme.primary) }}>Ir a mis carpetas</Link>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {folders.map((folder) => (
                <Link to={`/c/${folder.id}`} key={folder.id} className="@container group relative mx-auto flex aspect-[32/37] w-full max-w-[320px] cursor-pointer flex-col transition-transform duration-300 hover:-translate-y-2">
                  <div className="absolute inset-0 bg-[url('/images/carpeta_v4.webp')] bg-[length:100%_100%] bg-no-repeat drop-shadow-lg transition-all group-hover:drop-shadow-2xl" style={{ filter: getFolderFilter(folder.color) }} />
                  <div className="relative z-10 flex h-full w-full flex-col justify-between pb-[15%] pl-[18%] pr-[16%] pt-[5%]">
                    <div>
                      <div className="flex justify-end">
                        <div className="flex items-center gap-[1.5cqi] rounded-[3cqi] bg-black/30 px-[3cqi] py-[1.5cqi] text-[4.5cqi] font-bold text-white shadow-sm">
                          <span translate="no" className="material-symbols-outlined text-[5cqi]">style</span>
                          {folder.cardsCount}
                        </div>
                      </div>
                      <h3 className="mt-[2cqi] line-clamp-3 w-full break-words text-[11cqi] font-extrabold leading-tight text-white drop-shadow-md" title={folder.name}>{folder.name}</h3>
                    </div>
                    <span className="w-fit rounded-[2cqi] border border-white/60 px-[3cqi] py-[1cqi] text-[3.5cqi] font-bold uppercase tracking-wider text-white drop-shadow-sm">{folder.tcg}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {getSocialEnabled('showWishlist') && seller?.username && (
          <section className="min-w-0 border p-5 ring-1 empty:hidden lg:col-span-12" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: 99 }}>
            <WishlistSection
              username={seller.username}
              seller={{ id: seller.id, name: displayName, avatar: avatarUrl }}
              isOwner={isOwner}
              variant="profile"
              colors={{ primary: publicTheme.primary, accent: publicTheme.accent, text: publicTheme.text }}
            />
          </section>
        )}
        {seller?.username && (
          <section id="resenas" className="min-w-0 scroll-mt-32 border p-5 ring-1 lg:col-span-12" style={{ ...getCardStyle(publicTheme), borderColor: `${publicTheme.primary}33`, order: 98 }}>
            <ReviewsSection username={seller.username} isOwner={isOwner} colors={{ primary: publicTheme.primary, text: publicTheme.text }} />
          </section>
        )}
      </div>
    </main>
  );
}
