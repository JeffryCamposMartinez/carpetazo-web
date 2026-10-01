// Después de `vite build`: crea dist/terminos/index.html y dist/privacidad/index.html con el texto legal completo en el HTML.
// Así los verificadores que no ejecutan JavaScript (como el de Google para la pantalla de consentimiento) leen la política.
// Para las personas no cambia nada: es el mismo index.html del sitio, y React reemplaza este contenido al arrancar.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { termsBlocks, privacyBlocks } from '../src/legal/content.js';
import { TERMS_VERSION, PRIVACY_VERSION, LEGAL_UPDATED_LABEL } from '../src/legal/versions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');

const escape = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Mismo formato que la página React: **negrita** y [texto](enlace); todo lo demás se escapa
const inline = (text) => escape(text)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');

const renderBlocks = (blocks) => blocks.map((block) => {
  if (block.t === 'h2') return `<h2 id="${escape(block.id)}">${escape(block.x)}</h2>`;
  if (block.t === 'ul') return `<ul>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`;
  if (block.t === 'table') {
    const head = block.head.map((cell) => `<th>${inline(cell)}</th>`).join('');
    const rows = block.rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  return `<p>${inline(block.x)}</p>`;
}).join('\n');

const pages = [
  { path: 'terminos', title: 'Términos y Condiciones', version: TERMS_VERSION, blocks: termsBlocks, description: 'Términos y Condiciones de uso de Carpetazo.cl, plataforma chilena para publicar y encontrar cartas coleccionables (TCG).' },
  { path: 'privacidad', title: 'Política de Privacidad', version: PRIVACY_VERSION, blocks: privacyBlocks, description: 'Política de Privacidad de Carpetazo.cl: qué datos personales recopilamos, para qué los usamos, con quién los compartimos y cómo ejercer tus derechos.' }
];

for (const page of pages) {
  const article = `<main style="max-width:860px;margin:0 auto;padding:24px 16px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#1e293b">
<h1>${page.title}</h1>
<p>Versión ${page.version} · Vigente desde el ${escape(LEGAL_UPDATED_LABEL)} · Contacto: <a href="mailto:carpetazo.soporte@gmail.com">carpetazo.soporte@gmail.com</a></p>
${renderBlocks(page.blocks)}
</main>`;
  const pageTitle = `${page.title} · Carpetazo`;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(pageTitle)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${escape(page.description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="https://carpetazo.cl/${page.path}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${escape(pageTitle)}" />`)
    .replace('<div id="root"></div>', `<div id="root">${article}</div>`);
  if (!html.includes(`<h1>${page.title}</h1>`)) throw new Error(`No se pudo insertar el texto de /${page.path} en index.html`);
  // Enlace canónico: la misma dirección, sin barra final
  html = html.replace('</head>', `  <link rel="canonical" href="https://carpetazo.cl/${page.path}" />\n  </head>`);
  mkdirSync(join(dist, page.path), { recursive: true });
  writeFileSync(join(dist, page.path, 'index.html'), html);
  console.log(`  /${page.path}: ${page.blocks.length} bloques, ${Math.round(html.length / 1024)} KB`);
}
