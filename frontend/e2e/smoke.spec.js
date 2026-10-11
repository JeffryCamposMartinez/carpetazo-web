import { expect, test } from '@playwright/test';

// Qué cuenta como problema: errores de la página, fallas de la API (CORS, red caída, respuestas 5xx) y errores de CORS en la consola.
// Las imágenes de cartas que no cargan o los servicios de terceros (Google, Firebase) no cuentan.
const THIRD_PARTY = /firebase|googleapis|gstatic|google\.com|googletagmanager|identitytoolkit|securetoken/i;

const watch = (page) => {
  const problems = [];
  page.on('pageerror', (error) => problems.push(`error de la página: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && /CORS|blocked by|net::ERR_FAILED/i.test(message.text()) && !THIRD_PARTY.test(message.text())) problems.push(`consola: ${message.text().slice(0, 160)}`);
  });
  page.on('requestfailed', (request) => {
    if (/carpetazo\.cl\/api|\/api\//.test(request.url()) && !THIRD_PARTY.test(request.url())) problems.push(`falló ${request.method()} ${request.url()} (${request.failure()?.errorText})`);
  });
  page.on('response', (response) => {
    if (response.status() >= 500 && !THIRD_PARTY.test(response.url())) problems.push(`respuesta ${response.status()} en ${response.url()}`);
  });
  return problems;
};

const open = async (page, path) => {
  const problems = watch(page);
  const response = await page.goto(path, { waitUntil: 'networkidle' });
  expect(response?.status(), `estado de ${path}`).toBeLessThan(400);
  return problems;
};

const noSideScroll = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'la página no debe desbordar a los lados').toBeLessThanOrEqual(1);
};

test('portada: carga, muestra los juegos y no hay fallas', async ({ page }) => {
  const problems = await open(page, '/');
  await expect(page.getByRole('heading', { name: /Explora por juego/i })).toBeVisible();
  await expect(page.getByPlaceholder(/Busca cartas/i).locator('visible=true').first()).toBeVisible();
  await noSideScroll(page);
  expect(problems).toEqual([]);
});

for (const [path, heading] of [['/carpetas', /^Carpetas$/], ['/cartas', /Cartas en venta/i], ['/vendedores', /Vendedores/i]]) {
  test(`${path}: carga con su título y sin fallas`, async ({ page }) => {
    const problems = await open(page, path);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await noSideScroll(page);
    expect(problems).toEqual([]);
  });
}

test('buscador del encabezado: busca cartas y muestra resultados o el aviso de que no están a la venta', async ({ page }) => {
  const problems = await open(page, '/');
  const search = page.getByPlaceholder(/Busca cartas/i).locator('visible=true').first();
  await search.fill('zzzz cartainexistente');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/cartas\?q=/);
  await expect(page.getByText(/0 cartas a la venta|cartas? a la venta/i).first()).toBeVisible();
  await expect(page.getByText(/Ninguna carpeta vende|Tampoco encontramos|No encontramos cartas/i).first()).toBeVisible();
  expect(problems).toEqual([]);
});

test('una carta a la venta: su página muestra el nombre, las ofertas y el historial', async ({ page, request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const cardId = (xml.match(/\/carta\/([0-9a-f-]{36})/) || [])[1];
  test.skip(!cardId, 'no hay cartas a la venta para probar');
  const problems = await open(page, `/carta/${cardId}`);
  await expect(page.locator('h1').first()).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: /Vendedores/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Historial de precio/i })).toBeVisible();
  await noSideScroll(page);
  expect(problems).toEqual([]);
});

test('una carpeta pública: su catálogo carga sin fallas', async ({ page, request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  const folderId = (xml.match(/\/c\/([0-9a-f-]{36})/) || [])[1];
  test.skip(!folderId, 'no hay carpetas públicas para probar');
  const problems = await open(page, `/c/${folderId}`);
  await expect(page.locator('h1').first()).toBeVisible();
  await noSideScroll(page);
  expect(problems).toEqual([]);
});

test('las páginas legales cargan con su título', async ({ page }) => {
  const problems = await open(page, '/terminos');
  await expect(page.getByRole('heading', { name: /Términos/i }).first()).toBeVisible();
  expect(problems).toEqual([]);
});

test('una dirección que no existe muestra la página de no encontrado, no una pantalla en blanco', async ({ page }) => {
  await page.goto('/esta-pagina/no-existe/de-verdad', { waitUntil: 'networkidle' });
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.getByText(/no (existe|encontr)|404/i).first()).toBeVisible();
});
