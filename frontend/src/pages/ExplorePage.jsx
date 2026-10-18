import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import HeroCarousel from '../components/home/HeroCarousel';
import FeaturedZone from '../components/home/FeaturedZone';
import usePageMeta from '../hooks/usePageMeta';

export default function ExplorePage() {
  usePageMeta({ title: 'Carpetazo - Compra y vende cartas TCG en Chile', description: 'Compra y vende cartas de Pokémon, Mitos y Leyendas, Yu-Gi-Oh!, Magic, One Piece y Riftbound directo a jugadores de Chile. Explora carpetas, cartas y vendedores.', path: '/', jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Carpetazo', url: 'https://carpetazo.cl/', inLanguage: 'es-CL', potentialAction: { '@type': 'SearchAction', target: 'https://carpetazo.cl/cartas?q={search_term_string}', 'query-input': 'required name=search_term_string' } } });
  // Las cartas recientes alimentan el mosaico de destacados
  const [recentCards, setRecentCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getRecentCards(9)
      .then((res) => { if (!cancelled) setRecentCards(res.success ? res.cards : []); })
      .catch(() => { /* el mosaico muestra su estado vacío */ })
      .finally(() => { if (!cancelled) setLoadingCards(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16">
      <div className="relative z-10 flex min-h-[100svh] w-full flex-col overflow-hidden rounded-none border-outline-variant/30 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x">
        <div className="relative z-20 flex flex-1 flex-col items-center bg-[#DBEAFE] px-4 pb-4 pt-5 text-[#1a2b4b] sm:px-8 md:pt-8">
          <div className="w-full max-w-[1280px]">
            <HeroCarousel />
            <FeaturedZone recentCards={recentCards} loadingCards={loadingCards} />
          </div>
        </div>
      </div>
    </div>
  );
}
