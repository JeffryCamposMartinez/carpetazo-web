const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

// 1. Add fetchedAbility state
if (!code.includes("const [fetchedAbility, setFetchedAbility] = useState(null);")) {
  code = code.replace(
    "const [previewCard, setPreviewCard] = useState(null);",
    "const [previewCard, setPreviewCard] = useState(null);\n  const [fetchedAbility, setFetchedAbility] = useState(null);\n  const [fetchingAbility, setFetchingAbility] = useState(false);"
  );
}

// 2. Add useEffect to fetch ability
if (!code.includes("fetchAbility()")) {
  const fetchEffect = `
  useEffect(() => {
    if (previewCard && tcg === 'Mitos y Leyendas') {
      const fetchAbility = async () => {
        setFetchingAbility(true);
        setFetchedAbility(null);
        try {
          const res = await fetch('https://api.carpetazo.cl/api/tcg/search?q=' + encodeURIComponent(previewCard.name));
          const json = await res.json();
          if (json.success && json.data) {
            // Find by TCG ID if possible, otherwise by exact name match
            let match = json.data.find(c => c.productId == previewCard.tcgId || c.productId == previewCard.apiId);
            if (!match) match = json.data.find(c => c.name.toLowerCase() === previewCard.name.toLowerCase());
            
            if (match && match.extData && match.extData.effect) {
              // Strip HTML tags like <p> from the effect text
              setFetchedAbility(match.extData.effect.replace(/<[^>]*>?/gm, ''));
            } else {
              setFetchedAbility('Sin habilidad (Carta Vainilla)');
            }
          }
        } catch (err) {
          console.error("Error fetching ability", err);
          setFetchedAbility('Error al cargar habilidad');
        } finally {
          setFetchingAbility(false);
        }
      };
      fetchAbility();
    }
  }, [previewCard, tcg]);
`;
  code = code.replace("const handleKeyDown", fetchEffect + "\n    const handleKeyDown");
}

// 3. Update the UI to show fetchedAbility
const targetDisplay = `{previewCard.data?.ability || previewCard.ability || previewCard.extData?.ability || previewCard.data?.efecto || previewCard.efecto || previewCard.data?.text || previewCard.text || JSON.stringify(previewCard, null, 2)}`;
const replaceDisplay = `{fetchingAbility ? 'Buscando habilidad ancestral...' : (fetchedAbility || 'Sin habilidad registrada')}`;

code = code.replace(targetDisplay, replaceDisplay);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Injected dynamic ability fetching!");
