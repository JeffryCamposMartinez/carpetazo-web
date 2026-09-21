const fs = require('fs');
let code = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', 'utf8');

const regex = /useEffect\(\(\) => \{\s*useEffect\(\(\) => \{\s*if \(previewCard && tcg === 'Mitos y Leyendas'\) \{[\s\S]*?fetchAbility\(\);\s*\}\s*\}, \[previewCard, tcg\]\);/g;

code = code.replace(regex, `useEffect(() => {
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

  useEffect(() => {`);

fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/frontend/src/components/AlbumView.jsx', code);
console.log("Fixed with regex!");
