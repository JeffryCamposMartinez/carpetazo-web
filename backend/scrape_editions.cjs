const fs = require('fs');

async function fetchCards() {
  const allCards = [];
  let page = 1;
  const limit = 300;
  
  while (true) {
    console.log("Fetching page", page);
    const query = `
      query CardCatalog($CardCatalogInput: CardCatalogInput!) {
        CardCatalog(input: $CardCatalogInput) {
          cards {
            id
            name
            subtitle
            edition {
              id
              name
            }
          }
        }
      }
    `;
    const variables = {
      CardCatalogInput: {
        gameId: "primer-bloque",
        search: "",
        limit,
        page,
        groupReprints: false
      }
    };

    try {
      const res = await fetch('https://api.mazos.cl/graphql', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer 4mqbmG_TfeaE_yiboPkhgk9-AM2SmFD20K8fiZi4cB0'
          },
          body: JSON.stringify({ query, variables })
      });
      
      const data = await res.json();
      if (!data?.data?.CardCatalog?.cards || data.data.CardCatalog.cards.length === 0) {
        break;
      }
      
      const cards = data.data.CardCatalog.cards;
      allCards.push(...cards);
      
      console.log(`Got ${cards.length} cards, total so far: ${allCards.length}`);
      
      if (cards.length < limit) {
        break;
      }
      page++;
    } catch (e) {
      console.error(e);
      break;
    }
  }
  
  fs.writeFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/metadata_pb.json', JSON.stringify(allCards, null, 2));
  console.log(`Saved ${allCards.length} cards metadata!`);
}

fetchCards();
