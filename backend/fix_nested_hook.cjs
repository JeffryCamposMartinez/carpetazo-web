const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

// Replace the nested useEffect entirely.
// Find the exact string from `  useEffect(() => {\n      \n  useEffect(() => {\n      if (previewCard`
// to `    }, [previewCard, tcg]);`
// And replace it with just the top part of the handleKeyDown useEffect!

const malformedHook = `  useEffect(() => {
      
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
  }, [previewCard, tcg]);`;

const cleanHook = `  useEffect(() => {
    if (previewCard && tcg === 'Mitos y Leyendas') {
      const fetchAbility = async () => {
        setFetchingAbility(true);
        setFetchedAbility(null);
        try {
          const res = await fetch('https://api.carpetazo.cl/api/tcg/search?q=' + encodeURIComponent(previewCard.name));
          const json = await res.json();
          if (json.success && json.data) {
            let match = json.data.find(c => c.productId == previewCard.tcgId || c.productId == previewCard.apiId);
            if (!match) match = json.data.find(c => c.name.toLowerCase() === previewCard.name.toLowerCase());
            if (match && match.extData && match.extData.effect) {
              setFetchedAbility(match.extData.effect.replace(/<[^>]*>?/gm, ''));
            } else {
              setFetchedAbility('Sin habilidad (Carta Vainilla)');
            }
          }
        } catch (err) {
          setFetchedAbility('Error al cargar habilidad');
        } finally {
          setFetchingAbility(false);
        }
      };
      fetchAbility();
    }
  }, [previewCard, tcg]);

  useEffect(() => {`;

code = code.replace(malformedHook, cleanHook);
fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Fixed nested useEffect!");
