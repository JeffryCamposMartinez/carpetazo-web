async function run() {
  const query = `
    query CardCatalog($CardCatalogInput: CardCatalogInput!) {
      CardCatalog(input: $CardCatalogInput) {
        cards {
          id
          name
          createdAt
          edition {
            id
            name
            releaseDate
            createdAt
          }
        }
      }
    }
  `;
  const variables = { CardCatalogInput: { gameId: "primer-bloque", search: "oseye", limit: 1, page: 1, groupReprints: false } };
  try {
    const res = await fetch('https://api.mazos.cl/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer 4mqbmG_TfeaE_yiboPkhgk9-AM2SmFD20K8fiZi4cB0' },
        body: JSON.stringify({ query, variables })
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {}
}
run();
