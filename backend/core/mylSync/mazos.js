// Cliente de la API GraphQL de mazos.cl (la misma que usa CarpetazoUpdate). Solo lectura, con reintentos y una pausa entre peticiones.
const ENDPOINT = 'https://api.mazos.cl/graphql';
const PAUSE_MS = 300;

const PRODUCTS = 'query GetProducts($game: String) { products(game: $game, perPage: 200) { products { id name slug } } }';
const PRODUCT = 'query GetProduct($id: Int!) { product(id: $id) { id name slug productCards { card { id name slug imageUrl effect type mechanics frequency cost attack power race collectorCode edition { name } } } } }';
const CATALOG = 'query CardCatalog($CardCatalogInput: CardCatalogInput!) { CardCatalog(input: $CardCatalogInput) { cards { id slug name effect type cost attack power imageUrl frequency race collectorCode edition { name } } total pages } }';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class MazosClient {
  constructor({ fetchImpl = fetch, pauseMs = PAUSE_MS, retries = 3 } = {}) {
    Object.assign(this, { fetchImpl, pauseMs, retries });
  }

  async query(operationName, variables, query) {
    let lastError;
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await this.fetchImpl(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operationName, variables, query }), signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`mazos.cl respondió ${response.status}`);
        const body = await response.json();
        if (Array.isArray(body.errors) && body.errors.length) throw new Error(body.errors[0].message || 'Error GraphQL');
        await sleep(this.pauseMs);
        return body.data;
      } catch (error) {
        lastError = error;
        await sleep(2000 * (attempt + 1));
      }
    }
    throw new Error(`mazos.cl no respondió: ${lastError?.message}`);
  }

  // Productos (kits, displays, colecciones) de un bloque. Imperio no tiene: sus cartas solo salen del catálogo.
  async products(game) {
    return (await this.query('GetProducts', { game }, PRODUCTS)).products.products;
  }

  async productCards(id) {
    const product = (await this.query('GetProduct', { id }, PRODUCT)).product;
    return (product?.productCards || []).map((entry) => entry.card).filter(Boolean);
  }

  // Todas las cartas de un bloque, página a página
  async *catalog(game, limit = 200) {
    let page = 1;
    let pages = 1;
    while (page <= pages) {
      const { CardCatalog } = await this.query('CardCatalog', { CardCatalogInput: { gameId: game, search: null, page, limit, groupReprints: false } }, CATALOG);
      pages = CardCatalog.pages;
      yield { page, pages, cards: CardCatalog.cards };
      page++;
    }
  }
}
