import { api, apiUrl } from '../services/api';
import { classifyTcgcsvCard } from '../services/tcgcsvPokemon';
import { getExtDataValue } from '../components/folder/folderCards';
import { useEffect, useRef } from 'react';

// Búsqueda de cartas para agregar a una carpeta: Pokémon por ediciones (TCGCSV, de la más nueva a la más vieja), Mitos y Leyendas y el resto desde la base, con filtros.
export default function useCardSearch({ abortControllerRef, activeTab, availableSets, filterRarity,
  loadingFolder, mylCost, mylRace, mylType, searchBlock, searchCategory, searchLang, searchPhysicalProduct,
  searchQuery, searchSet, selectedSupertype, selectedType, setAvailableRarities, setFilterRarity,
  setFilterType, setHasMoreGroups, setHasSearchedAPI, setIsSearching, setRawSearchResults, showToast }) {
  // --- Pokémon (TCGCSV): en "Todas las ediciones" se cargan ediciones de a poco, de la más nueva a la más vieja ---
  const pokeQueueRef = useRef([]);
  const pokeGroupCacheRef = useRef(new Map());
  const pokeGenRef = useRef(0);
  const pokeLoadingRef = useRef(false);
  const pokeCatRef = useRef(3);
  const loadMorePokemonRef = useRef(null);

  const fetchPokemonGroup = async (group, catId, signal) => {
    const key = `${catId}-${group.groupId}`;
    if (pokeGroupCacheRef.current.has(key)) return pokeGroupCacheRef.current.get(key);
    const json = await (await fetch(apiUrl(`/tcgcsv/tcgplayer/${catId}/${group.groupId}/products`), { signal })).json();
    const list = (json.results || [])
      .map(p => {
        const ext = {};
        (p.extendedData || []).forEach(e => { ext[e.name] = e.value; });
        return { p, ext };
      })
      .filter(({ ext }) => ext.Number)
      .map(({ p, ext }) => ({
        id: p.productId,
        tcgProductId: p.productId,
        name: p.name,
        imageUrl: (p.imageUrl || '').replace('_200w', '_400w'),
        categoryId: 1,
        cardLanguage: catId === 85 ? 'Japanese' : 'English',
        groupId: p.groupId,
        group: { id: p.groupId, name: group?.name || '', publishedOn: group?.publishedOn },
        extData: { ...ext, localId: ext.Number, ...classifyTcgcsvCard(p.name, ext) },
      }));
    const extractNum = (str) => { const m = (str || '').match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
    list.sort((a, b) => {
      const idA = String(a.extData.localId), idB = String(b.extData.localId);
      return extractNum(idA) - extractNum(idB) || idA.localeCompare(idB);
    });
    pokeGroupCacheRef.current.set(key, list);
    return list;
  };

  // Filtros de categoría, tipo y rareza (también los usa la carga por ediciones para saber cuándo hay suficientes resultados)
  const applyCardFilters = (list) => {
    if (selectedSupertype) {
        const catMap = { "Pokémon": "Pokémon", "Trainer": "Entrenador", "Energy": "Energía" };
        list = list.filter(c => c.extData?.category === catMap[selectedSupertype]);
      }
      
      if (selectedType) {
          const typeMap = {
            "Grass": "Planta", "Fire": "Fuego", "Water": "Agua", "Lightning": "Rayo",
            "Psychic": "Psíquico", "Fighting": "Lucha", "Darkness": "Oscura", 
            "Metal": "Metálica", "Fairy": "Hada", "Dragon": "Dragón", "Colorless": "Incolora"
          };
          const energyMap = {
            "Grass": "Planta", "Fire": "Fuego", "Water": "Agua", "Lightning": "Rayo",
            "Psychic": "Psíquic", "Fighting": "Lucha", "Darkness": "Oscura", 
            "Metal": "Metálic", "Fairy": "Hada", "Dragon": "Dragón", "Colorless": "Incolora"
          };
          
          const targetType = typeMap[selectedType] || selectedType;
          const targetEnergy = energyMap[selectedType] || targetType;
          
          list = list.filter(c => {
             if (c.extData?.types && Array.isArray(c.extData.types) && c.extData.types.length > 0) {
                return c.extData.types.includes(targetType);
             }
             if (c.extData?.category === "Energía") {
                 return (c.name || "").includes(targetEnergy);
             }
             return false;
          });
        }

    if (filterRarity) {
      list = list.filter(c => {
        const rVal = getExtDataValue(c.extData, 'Rarity') || getExtDataValue(c.extData, 'Card Number / Rarity'); return rVal === filterRarity;
      });
    }
    return list;
  };

  // Carga ediciones de la cola hasta juntar `target` cartas que coincidan con el texto buscado
  const loadPokemonGroups = async (target, gen, signal, q) => {
    const catId = pokeCatRef.current;
    const all = [];
    let matches = 0;
    while (matches < target && pokeQueueRef.current.length > 0 && gen === pokeGenRef.current) {
      const batch = pokeQueueRef.current.splice(0, 3);
      const lists = await Promise.all(batch.map(g => fetchPokemonGroup(g, catId, signal).catch(err => { if (err.name === 'AbortError') throw err; return []; })));
      if (gen !== pokeGenRef.current) return [];
      lists.forEach(l => {
        const byText = l.filter(c => !q || c.name.toLowerCase().includes(q) || String(c.extData.Number).toLowerCase().includes(q));
        all.push(...byText);
        matches += applyCardFilters(byText).length;
      });
    }
    if (gen === pokeGenRef.current) setHasMoreGroups(pokeQueueRef.current.length > 0);
    return all;
  };

  const loadMorePokemon = async () => {
    if (pokeLoadingRef.current || pokeQueueRef.current.length === 0) return;
    pokeLoadingRef.current = true;
    const gen = pokeGenRef.current;
    try {
      const added = await loadPokemonGroups(10, gen, abortControllerRef.current?.signal, searchQuery.trim().toLowerCase());
      if (gen === pokeGenRef.current && added.length) {
        setRawSearchResults(prev => [...prev, ...added]);
        setAvailableRarities(prev => [...new Set([...prev, ...added.map(c => c.extData.Rarity).filter(Boolean)])].sort());
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
    } finally {
      pokeLoadingRef.current = false;
    }
  };
  loadMorePokemonRef.current = loadMorePokemon;

  const handleSearchAPI = async (e) => {
    e.preventDefault();
    if (!searchCategory) {
      showToast('Selecciona un TCG.', 'error');
      return;
    }
    
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    try {
      let cards = [];
      if (searchCategory === '1') {
          const q = searchQuery.trim().toLowerCase();
          const catId = searchLang === 'ja' ? 85 : 3;
          const gen = ++pokeGenRef.current;
          pokeLoadingRef.current = false;
          setHasMoreGroups(false);
          if (searchSet) {
            pokeQueueRef.current = [];
            const group = availableSets.find(s => s.groupId == searchSet) || { groupId: searchSet };
            cards = (await fetchPokemonGroup(group, catId, abortControllerRef.current.signal))
              .filter(c => !q || c.name.toLowerCase().includes(q) || String(c.extData.Number).toLowerCase().includes(q));
          } else {
            // Todas las ediciones: esperar a que cargue la lista de ediciones (la búsqueda se relanza sola)
            if (availableSets.length === 0) {
              setIsSearching(false);
              return;
            }
            pokeQueueRef.current = [...availableSets];
            pokeCatRef.current = catId;
            cards = await loadPokemonGroups(1, gen, abortControllerRef.current.signal, q);
            if (gen !== pokeGenRef.current) return;
          }
        } else {
          const mylFilters = searchCategory === '99' ? { type: mylType, race: mylRace, cost: mylCost, blockId: searchBlock, physicalProductId: searchPhysicalProduct } : {};
          
          if (searchSet && searchQuery.trim() === '') {
            const response = await api.getTcgProducts(searchCategory, searchSet, mylFilters);
            cards = response.data || [];
          } else {
            const response = await api.searchTcgProducts(searchQuery.trim(), searchCategory, searchSet, mylFilters);
            cards = response.data || [];
          }
        }

      const rarities = new Set();
      cards.forEach(c => {
        const rVal = getExtDataValue(c.extData, 'Rarity') || getExtDataValue(c.extData, 'Card Number / Rarity'); if (rVal) rarities.add(rVal);
      });
      setAvailableRarities(Array.from(rarities).sort());
      setFilterRarity('');
      setFilterType('all');
      
        const extractNum = (str) => {
          const match = (str || '').match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };

        cards.sort((a, b) => {
          if (!searchSet) {
            // Intentar alinear exactamente con el orden visual del dropdown (availableSets)
            let indexA = availableSets.findIndex(s => s.groupId === a.groupId);
            let indexB = availableSets.findIndex(s => s.groupId === b.groupId);
            
            if (indexA !== -1 && indexB !== -1) {
              if (indexA !== indexB) return indexA - indexB;
            } else {
              // Fallback si availableSets aun no carga: ordenar por fecha del backend
              const dateA = a.group?.publishedOn ? new Date(a.group.publishedOn).getTime() : 0;
              const dateB = b.group?.publishedOn ? new Date(b.group.publishedOn).getTime() : 0;
              if (dateB !== dateA) return dateB - dateA;
              // Desempate de seguridad: si dos ediciones salieron el mismo dia (ej. Celebracion 30), agruparlas por su ID para no mezclarlas
              if (b.groupId !== a.groupId) return (b.groupId || 0) - (a.groupId || 0);
            }
          }
          
          // Orden numérico interno de la edición (001, 002)
          const idA = (a.extData?.localId || '').toString();
          const idB = (b.extData?.localId || '').toString();
          const numA = extractNum(idA);
          const numB = extractNum(idB);
          if (numA !== numB) return numA - numB;
          return idA.localeCompare(idB);
        });

        setRawSearchResults(cards);

      setHasSearchedAPI(true);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error(error);
        showToast('Error al buscar cartas en la API', 'error');
      }
    } finally {
      setIsSearching(false);
    }
  };

  
    const firstRenderFilters = useRef(true);
    useEffect(() => {
      if (firstRenderFilters.current) {
        firstRenderFilters.current = false;
        return;
      }
      if (activeTab === 'add' && !loadingFolder && searchCategory) {
        const timeoutId = setTimeout(() => {
          handleSearchAPI({ preventDefault: () => {} });
        }, 500);
        return () => clearTimeout(timeoutId);
      }
    }, [searchBlock, searchSet, searchPhysicalProduct, mylType, mylRace, mylCost, searchQuery]);

  return { applyCardFilters, handleSearchAPI, loadMorePokemonRef, pokeGenRef, pokeLoadingRef, pokeQueueRef };
}
