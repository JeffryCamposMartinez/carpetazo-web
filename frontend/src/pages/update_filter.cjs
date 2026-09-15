const fs = require('fs');
const path = 'C:/Users/Jeffry/Desktop/Publicar mis cartas/frontend/src/pages/FolderPokemon.jsx';

if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');

  // 1. Add state variables
  if (!content.includes('const [rawSearchResults')) {
    content = content.replace(
      'const [hasSearchedAPI, setHasSearchedAPI] = useState(false);',
      `const [hasSearchedAPI, setHasSearchedAPI] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterRarity, setFilterRarity] = useState('');
  const [availableRarities, setAvailableRarities] = useState([]);
  const [rawSearchResults, setRawSearchResults] = useState([]);`
    );
  }

  // 2. Add useEffect for filtering
  if (!content.includes('rawSearchResults, filterType, filterRarity, searchQuery')) {
    const useEffectFilter = `
  useEffect(() => {
    let filtered = rawSearchResults;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.cleanName && c.cleanName.toLowerCase().includes(q)) ||
        (c.extData && Array.isArray(c.extData) && c.extData.some(x => (x.name === 'Number' || x.name === 'Card Number / Rarity') && x.value && x.value.toLowerCase().includes(q)))
      );
    }

    if (filterType !== 'all') {
      const sealedKeywords = ['booster', 'box', 'pack', 'deck', 'case', 'blister', 'display', 'collection', 'tin', 'elite trainer', 'bundle', 'kit', 'theme', 'starter'];
      filtered = filtered.filter(c => {
        const lowerName = (c.name || '').toLowerCase();
        const isSealed = sealedKeywords.some(kw => lowerName.includes(kw));
        return filterType === 'sealed' ? isSealed : !isSealed;
      });
    }

    if (filterRarity) {
      filtered = filtered.filter(c => {
        if (!c.extData || !Array.isArray(c.extData)) return false;
        const rObj = c.extData.find(x => x.name === 'Rarity' || x.name === 'Card Number / Rarity');
        return rObj && rObj.value === filterRarity;
      });
    }

    setSearchResults(filtered);
  }, [rawSearchResults, filterType, filterRarity, searchQuery]);

`;
    // Insert before handleSearchAPI
    content = content.replace('const handleSearchAPI = async (e) => {', useEffectFilter + 'const handleSearchAPI = async (e) => {');
  }

  // 3. Update handleSearchAPI body
  content = content.replace(
    /let cards = response\.data \|\| \[\];[\s\S]*?setSearchResults\(cards\);\s*setHasSearchedAPI\(true\);/,
    `let cards = response.data || [];
      
      const rarities = new Set();
      cards.forEach(c => {
        if (c.extData && Array.isArray(c.extData)) {
          const rarityObj = c.extData.find(x => x.name === 'Rarity' || x.name === 'Card Number / Rarity');
          if (rarityObj && rarityObj.value) rarities.add(rarityObj.value);
        }
      });
      setAvailableRarities(Array.from(rarities).sort());
      setFilterRarity('');
      setFilterType('all');
      setRawSearchResults(cards);
      setHasSearchedAPI(true);`
  );

  // 4. Inject UI
  const newUI = `</div>
          
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col gap-4 mt-2">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center w-full sm:w-auto bg-white p-1 rounded-lg border border-gray-200">
                <button type="button" onClick={() => setFilterType('all')} className={\`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors \${filterType === 'all' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}\`}>Todos</button>
                <button type="button" onClick={() => setFilterType('cards')} className={\`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors \${filterType === 'cards' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}\`}>Cartas</button>
                <button type="button" onClick={() => setFilterType('sealed')} className={\`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-bold transition-colors \${filterType === 'sealed' ? 'bg-[#1e40af] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}\`}>Sellado</button>
              </div>
              
              {availableRarities.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[200px]">
                  <span className="text-sm font-bold text-gray-700">Rareza:</span>
                  <select 
                    value={filterRarity} 
                    onChange={(e) => setFilterRarity(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:border-[#1e40af] focus:ring-1 focus:ring-[#1e40af] text-sm"
                  >
                    <option value="">Todas</option>
                    {availableRarities.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center mt-4">`;

  content = content.replace('</div>\n          <div className="flex justify-center mt-4">', newUI);

  fs.writeFileSync(path, content, 'utf8');
  console.log('UI and Logic updated successfully.');
} else {
  console.log('File not found');
}
