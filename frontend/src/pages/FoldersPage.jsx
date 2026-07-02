import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, query, where, getCountFromServer } from 'firebase/firestore';
import { getFolderFilter } from './Dashboard';

import LazyFolderCard from '../components/LazyFolderCard';

export default function FoldersPage() {
  const [folders, setFolders] = useState([]);
  const [filteredFolders, setFilteredFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedTcg, setSelectedTcg] = useState('Todos');
  const [sortBy, setSortBy] = useState('weekly');
  const [isTcgDropdownOpen, setIsTcgDropdownOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 40;

  const tcgCategories = [
    { name: 'Pokémon', logo: '/images/logos/pokemon.png', scaleClass: 'scale-[0.9]' },
    { name: 'One Piece', logo: '/images/logos/onepiece.webp', scaleClass: 'scale-[1.3]' },
    { name: 'Magic', logo: '/images/logos/magic.png', scaleClass: 'scale-[1.2]' },
    { name: 'Yu-Gi-Oh!', logo: '/images/logos/yugioh.png', scaleClass: 'scale-[1.8]' },
    { name: 'Riftbound', logo: '/images/logos/riftbound.png', scaleClass: 'scale-[0.9]' },
    { name: 'Mitos y Leyendas', logo: '/images/logos/mitosyleyendas.webp', scaleClass: 'scale-[1.1]' }
  ];

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setSearchQuery(q);
    setCurrentPage(1);
  }, [searchParams]);

  useEffect(() => {
    const fetchFolders = async () => {
      setLoading(true);
      try {
        const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
        const q = query(collection(db, 'folders'), where('isPublic', '==', true));
        const foldersSnapshot = await getDocs(q);
        
        let allFolders = [];
        for (const folderDoc of foldersSnapshot.docs) {
          const folder = { id: folderDoc.id, ...folderDoc.data() };
          folder.validWeeklyVisits = folder.lastVisitWeek === currentWeek ? (folder.weeklyVisits || 0) : 0;
          folder.validTotalVisits = folder.totalVisits || 0;
          
          folder.cardsCount = 0;
          folder.user = folder.userId ? folder.userId.substring(0, 6) : 'Usuario';
          folder.location = '';
          folder.avatarUrl = null;
          allFolders.push(folder);
        }
        setFolders(allFolders);
      } catch (error) {
        console.error("Error fetching folders:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFolders();
  }, []);

  useEffect(() => {
    let result = [...folders];

    const normalize = (str) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    };

    if (selectedTcg !== 'Todos') {
      result = result.filter(f => f.tcg && normalize(f.tcg) === normalize(selectedTcg));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => 
        (f.name && f.name.toLowerCase().includes(q)) || 
        (f.user && f.user.toLowerCase().includes(q))
      );
    }

    if (sortBy === 'weekly') {
      result.sort((a, b) => b.validWeeklyVisits - a.validWeeklyVisits || b.validTotalVisits - a.validTotalVisits);
    } else if (sortBy === 'total') {
      result.sort((a, b) => b.validTotalVisits - a.validTotalVisits);
    } else if (sortBy === 'name') {
      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    setFilteredFolders(result);
    setCurrentPage(1);
  }, [folders, selectedTcg, searchQuery, sortBy]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setSearchParams(e.target.value ? { q: e.target.value } : {});
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedTcg('Todos');
    setSearchQuery('');
    setSearchParams({});
    setSortBy('weekly');
    setCurrentPage(1);
  };

  const selectedTcgInfo = tcgCategories.find(c => c.name === selectedTcg);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const foldersToRender = filteredFolders.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredFolders.length / itemsPerPage);

  return (
    <div className="w-full max-w-[1600px] mx-auto xl:px-12 2xl:px-16 flex-1 flex flex-col">
      <div className="w-full rounded-none overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] md:border-x border-gray-300 flex flex-col lg:flex-row relative z-10 min-h-[calc(100vh-80px)] bg-[#DBEAFE]">
        <aside className="w-full lg:w-[280px] bg-white border-b lg:border-b-0 lg:border-r border-gray-300 p-6 shrink-0 flex flex-col">
          <div className="flex items-center gap-2 mb-6 pb-3 border-b border-gray-100">
            <span translate="no" className="material-symbols-outlined text-[#1e40af]">filter_alt</span>
            <h3 className="font-extrabold text-[#1a2b4b] text-base">Filtros Avanzados</h3>
          </div>
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">1. Juego (TCG):</span>
            <div className="relative">
              <button onClick={() => setIsTcgDropdownOpen(!isTcgDropdownOpen)} className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-blue-50/50 border border-gray-200 hover:border-blue-200 rounded-xl text-xs font-bold text-gray-700 transition-all text-left">
                <div className="flex items-center gap-2">
                  {selectedTcgInfo ? (
                    <div className="w-5 h-5 flex items-center justify-center overflow-hidden shrink-0 bg-white rounded p-0.5 shadow-sm border border-gray-100">
                      <img src={selectedTcgInfo.logo} alt={selectedTcg} className={`max-w-full max-h-full object-contain ${selectedTcgInfo.scaleClass || 'scale-100'}`} />
                    </div>
                  ) : (
                    <span translate="no" className="material-symbols-outlined text-gray-400 text-[18px]">sports_esports</span>
                  )}
                  <span>{selectedTcg === 'Todos' ? 'Todos los TCG' : selectedTcg}</span>
                </div>
                <span translate="no" className="material-symbols-outlined text-gray-400 transition-transform duration-200" style={{ transform: isTcgDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
              </button>
              {isTcgDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsTcgDropdownOpen(false)}></div>
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-40 max-h-60 overflow-y-auto py-1 animate-[fadeIn_0.15s_ease-out]">
                    <button onClick={() => { setSelectedTcg('Todos'); setIsTcgDropdownOpen(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-blue-50 text-left text-xs font-bold text-gray-700 hover:text-[#1e40af] transition-colors">
                      <span translate="no" className="material-symbols-outlined text-gray-400 text-[16px] w-6 text-center">apps</span>
                      <span>Todos los TCG</span>
                    </button>
                    {tcgCategories.map((tcg) => (
                      <button key={tcg.name} onClick={() => { setSelectedTcg(tcg.name); setIsTcgDropdownOpen(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-blue-50 text-left text-xs font-bold text-gray-700 hover:text-[#1e40af] transition-colors border-t border-gray-50">
                        <div className="w-6 h-6 flex items-center justify-center overflow-hidden shrink-0 bg-white rounded-md p-1 shadow-sm border border-gray-50">
                          <img src={tcg.logo} alt={tcg.name} className={`max-w-full max-h-full object-contain ${tcg.scaleClass || 'scale-100'}`} />
                        </div>
                        <span>{tcg.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-col gap-5 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Buscar:</label>
                <div className="relative">
                  <span translate="no" className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">search</span>
                  <input type="text" placeholder="Carpeta o vendedor..." value={searchQuery} onChange={handleSearchChange} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400 font-medium" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ordenar por:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold">
                  <option value="weekly">Más populares (Semanal)</option>
                  <option value="total">Más visitadas (Total)</option>
                  <option value="name">Nombre (A-Z)</option>
                </select>
              </div>
              <button onClick={clearFilters} className="mt-2 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1">
                <span translate="no" className="material-symbols-outlined text-[16px]">restart_alt</span>
                Limpiar Filtros
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 text-gray-900 px-4 sm:px-8 py-8 flex flex-col relative z-20 bg-[#DBEAFE]">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-300">
            <div>
              <h1 className="text-3xl font-extrabold text-[#1a2b4b]">Explorar Carpetas</h1>
              <p className="text-gray-600 text-sm mt-1">Busca y filtra catálogos creados por nuestra comunidad</p>
            </div>
          </div>
          {loading ? (
            <div className="w-full flex-1 flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : foldersToRender.length === 0 ? (
            <div className="w-full flex-1 flex flex-col items-center justify-center py-20 bg-white/40 border border-white/20 rounded-2xl p-8 text-center">
              <span translate="no" className="material-symbols-outlined text-6xl text-gray-400 mb-4">folder_open</span>
              <h3 className="text-xl font-bold text-[#1a2b4b]">No se encontraron carpetas</h3>
              <p className="text-gray-500 text-sm mt-1 max-w-sm">Intenta cambiando el filtro TCG o buscando con otros términos.</p>
              <button onClick={clearFilters} className="mt-6 px-5 py-2.5 bg-[#1e40af] text-white font-bold rounded-xl shadow-md text-xs hover:bg-blue-800 transition-colors">
                Limpiar Filtros
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 pb-6">
                {foldersToRender.map((folder) => (
                  <LazyFolderCard key={folder.id} folder={folder} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex flex-wrap justify-center items-center gap-4 mt-8 pt-6 border-t border-gray-300/40 pb-6">
                  <button disabled={currentPage === 1} onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-bold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                    <span translate="no" className="material-symbols-outlined text-[16px]">chevron_left</span>
                    Anterior
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">Página</span>
                    <select value={currentPage} onChange={(e) => { setCurrentPage(Number(e.target.value)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="bg-white border border-gray-200 text-xs rounded-xl px-3 py-1.5 font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <option key={page} value={page}>{page}</option>
                      ))}
                    </select>
                    <span className="text-xs font-bold text-gray-500">de {totalPages}</span>
                  </div>
                  <button disabled={currentPage === totalPages} onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-bold text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                    Siguiente
                    <span translate="no" className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}
