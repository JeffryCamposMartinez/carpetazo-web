// Importa un bloque de cartas desde carpetas con data.json a la base (cualquier TCG mediante un adaptador).
//
//   node import_tcg_block.cjs --game myl --block "Primer Bloque" --dir "<...>/Primer_Bloque_DB"            (simula y muestra el informe)
//   node import_tcg_block.cjs --game myl --block "Primer Bloque" --dir "<...>/Primer_Bloque_DB" --apply    (escribe en la base)
//   Opciones: --prune-empty-products  borra los productos del bloque que quedan sin cartas   |   --report archivo.json
//
// Estructura esperada (adaptador "myl"): <dir>/<Nombre>_Data/<PRODUCTO>/<carpeta de carta>/data.json
//   - El nombre de cada subcarpeta ES el nombre del producto (kit, display, colección…).
//   - Una carta que viene en varios productos aparece en varias carpetas con el mismo id: se guarda una sola vez y
//     se enlaza a todos sus productos (tabla TcgProductPhysicalProduct).
//   - Cada carta trae su información completa en data.json.
// Para otro juego basta con agregar un adaptador en ADAPTERS (cómo leer la carta y qué juego/bloque le corresponde).
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name) => args.includes(`--${name}`);

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cleanName = (s) => normalize(s).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const GROUP_ID_BASE = 900000; // ids propios para ediciones que no vienen de TCGplayer (evita choques con sus ids)

// ---------------------------------------------------------------------------------------------------------------
// Adaptadores por juego
// ---------------------------------------------------------------------------------------------------------------
const ADAPTERS = {
  // Mitos y Leyendas (data.json de mazos.cl)
  myl: {
    categoryId: 99,
    cardId: (j) => String(j.id),
    cardName: (j) => String(j.name).trim(),
    editionName: (j) => j.edition && j.edition.name,
    // Misma forma que ya usa la base para estas cartas: lista de { name, value }.
    // Un atributo con varios valores (razas, mecánicas) se guarda como una entrada por valor: el filtro
    // del servidor busca coincidencia exacta con cualquiera de ellas.
    extData: (j) => {
      const items = [
        ['Type', j.type],
        ['Cost', j.cost],
        ['Fuerza', j.attack],
        ...(Array.isArray(j.race) ? j.race : [j.race]).map((r) => ['Race', r]),
        ['Edition', j.edition && j.edition.name],
        ['Frequency', j.frequency],
        ['Number', j.collectorCode],
        ['Format', j.format],
        ['Slug', j.slug],
        ['Effect', j.effect],
        ...(Array.isArray(j.mechanics) ? j.mechanics.map((m) => ['Mechanics', m.name]) : []),
      ];
      // Los data.json traen espacios sobrantes; los ceros (coste/fuerza 0) son datos reales y se conservan
      return items
        .map(([name, value]) => [name, value === null || value === undefined ? '' : String(value).trim()])
        .filter(([, v]) => v !== '')
        .map(([name, value]) => ({ name, value }));
    },
  },
};

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

(async () => {
  const gameKey = opt('game');
  const blockName = opt('block');
  const dir = opt('dir');
  const apply = flag('apply');
  const adapter = ADAPTERS[gameKey];
  if (!adapter || !blockName || !dir) {
    console.error('Uso: node import_tcg_block.cjs --game myl --block "Primer Bloque" --dir <carpeta_DB> [--apply] [--prune-empty-products] [--report archivo.json]');
    process.exit(1);
  }
  const dirName = path.basename(dir);
  const base = dirName.replace(/_DB$/, '');
  const dataRoot = path.join(dir, `${base}_Data`);
  const imageRoot = path.join(dir, `${base}_Images`);
  const gameFolder = path.basename(path.dirname(dir)); // p. ej. Mitos_y_Leyendas
  const r2Base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

  const prisma = new PrismaClient();
  try {
    const block = await prisma.tcgBlock.findFirst({ where: { categoryId: adapter.categoryId, name: blockName } });
    if (!block) throw new Error(`No existe el bloque "${blockName}" en el juego ${adapter.categoryId}`);

    // 1) Lectura del disco
    const cards = new Map(); // id -> { json, products:Set, firstFolder }
    let folders = 0;
    for (const product of fs.readdirSync(dataRoot).sort()) {
      const pPath = path.join(dataRoot, product);
      if (!fs.statSync(pPath).isDirectory()) continue;
      for (const cardFolder of fs.readdirSync(pPath).sort()) {
        const file = path.join(pPath, cardFolder, 'data.json');
        if (!fs.existsSync(file)) continue;
        folders++;
        const json = readJson(file);
        const id = adapter.cardId(json);
        if (!cards.has(id)) cards.set(id, { json, products: new Set(), firstFolder: { product, cardFolder } });
        cards.get(id).products.add(product);
      }
    }
    const productNames = [...new Set([...cards.values()].flatMap((c) => [...c.products]))].sort();
    const editionNames = [...new Set([...cards.values()].map((c) => adapter.editionName(c.json)).filter(Boolean))].sort();

    // 2) Estado actual de la base para este bloque
    const groups = await prisma.tcgGroup.findMany({ where: { blockId: block.id } });
    const groupByName = new Map(groups.map((g) => [cleanName(g.name), g]));
    const physical = await prisma.tcgPhysicalProduct.findMany({ where: { categoryId: adapter.categoryId, blockId: block.id } });
    const physicalByName = new Map(physical.map((p) => [p.name, p]));
    const existing = await prisma.tcgProduct.findMany({
      where: { productId: { in: [...cards.keys()] } },
      select: { productId: true, name: true, cleanName: true, imageUrl: true, extData: true, groupId: true, categoryId: true, physicalProductId: true, group: { select: { blockId: true } } },
    });
    const existingById = new Map(existing.map((e) => [e.productId, e]));
    const dbBlockIds = new Set((await prisma.tcgProduct.findMany({ where: { group: { blockId: block.id } }, select: { productId: true } })).map((r) => r.productId));

    // 3) Plan
    const plan = {
      bloque: `${blockName} (id ${block.id})`,
      carpetasDeCarta: folders,
      cartasUnicas: cards.size,
      productos: productNames.length,
      ediciones: editionNames.length,
      edicionesNuevas: editionNames.filter((n) => !groupByName.has(cleanName(n))),
      productosNuevos: productNames.filter((n) => !physicalByName.has(n)).length,
      productosExistentesReutilizados: productNames.filter((n) => physicalByName.has(n)).length,
      cartasNuevas: [...cards.keys()].filter((id) => !existingById.has(id)).length,
      cartasExistentes: existing.length,
      cartasEnOtroJuego: existing.filter((e) => e.categoryId !== adapter.categoryId).length,
      cartasQueYaVivenEnOtroBloque: existing.filter((e) => e.group && e.group.blockId !== block.id).length,
      cartasEnLaBaseYNoEnDisco: [...dbBlockIds].filter((id) => !cards.has(id)).length,
    };
    let changedName = 0, changedExt = 0, changedGroup = 0;
    const extDiffKeys = new Map();
    for (const [id, c] of cards) {
      const e = existingById.get(id);
      if (!e) continue;
      const nextExt = adapter.extData(c.json);
      if (e.name !== adapter.cardName(c.json)) changedName++;
      const editionName = adapter.editionName(c.json);
      const g = groupByName.get(cleanName(editionName));
      if (g && g.groupId !== e.groupId) changedGroup++;
      const group = (list) => { const m = new Map(); for (const x of list) m.set(x.name, (m.get(x.name) ? m.get(x.name) + ' | ' : '') + x.value); return m; };
      const prev = group(Array.isArray(e.extData) ? e.extData : []);
      const next = group(nextExt);
      let differs = false;
      for (const k of new Set([...prev.keys(), ...next.keys()])) {
        if (prev.get(k) !== next.get(k)) { differs = true; extDiffKeys.set(k, (extDiffKeys.get(k) || 0) + 1); }
      }
      if (differs) changedExt++;
    }
    plan.cambios = { nombre: changedName, edicion: changedGroup, extData: changedExt, extData_porCampo: Object.fromEntries(extDiffKeys) };

    if (!apply) {
      console.log('SIMULACIÓN (no se escribió nada). Agrega --apply para importar.\n');
      console.log(JSON.stringify(plan, null, 1));
      if (opt('report')) fs.writeFileSync(opt('report'), JSON.stringify({ plan, productos: productNames, ediciones: editionNames }, null, 1));
      return;
    }

    // 4) Escritura atómica
    const result = await prisma.$transaction(async (tx) => {
      // Ediciones
      let nextGroupId = Math.max(GROUP_ID_BASE, (await tx.tcgGroup.aggregate({ _max: { groupId: true } }))._max.groupId + 1);
      const groupIdByName = new Map(groups.map((g) => [cleanName(g.name), g.groupId]));
      for (const name of editionNames) {
        if (groupIdByName.has(cleanName(name))) continue;
        const created = await tx.tcgGroup.create({ data: { groupId: nextGroupId++, name, blockId: block.id, categoryId: adapter.categoryId, publishedOn: new Date(), modifiedOn: new Date() } });
        groupIdByName.set(cleanName(name), created.groupId);
      }
      // Productos: el nombre de la subcarpeta es el nombre del producto
      const productId = new Map(physical.map((p) => [p.name, p.id]));
      for (const name of productNames) {
        if (productId.has(name)) continue;
        const created = await tx.tcgPhysicalProduct.create({ data: { name, blockId: block.id, categoryId: adapter.categoryId } });
        productId.set(name, created.id);
      }
      // Cartas
      const toCreate = [];
      let updated = 0;
      let skippedOtherBlock = 0;
      for (const [id, c] of cards) {
        const e = existingById.get(id);
        const editionName = adapter.editionName(c.json);
        const groupId = groupIdByName.get(cleanName(editionName));
        if (!groupId) throw new Error(`Carta ${id} sin edición válida`);
        const wanted = [...c.products].map((n) => productId.get(n));
        const primary = e && wanted.includes(e.physicalProductId) ? e.physicalProductId : wanted[0];
        const name = adapter.cardName(c.json);
        const extData = adapter.extData(c.json);
        if (e && e.group && e.group.blockId !== block.id) {
          skippedOtherBlock++; // ya pertenece a otro bloque: no se mueve de edición, solo se enlaza a los productos de este bloque
        } else if (e) {
          await tx.tcgProduct.update({ where: { productId: id }, data: { name, cleanName: cleanName(name), extData, groupId, categoryId: adapter.categoryId, physicalProductId: primary } });
          updated++;
        } else {
          const { product, cardFolder } = c.firstFolder;
          const imgDir = path.join(imageRoot, product, cardFolder);
          const img = fs.existsSync(imgDir) ? fs.readdirSync(imgDir).find((f) => /\.(webp|png|jpg)$/i.test(f)) : null;
          const fileName = (img ? img.replace(/\.(png|jpg)$/i, '.webp') : `${name}.webp`);
          const imageUrl = `${r2Base}/${encodePath(`Carpetazo.cl/${gameFolder}/${dirName}/${base}_Images/${product}/${cardFolder}/${fileName}`)}`;
          toCreate.push({ productId: id, name, cleanName: cleanName(name), imageUrl, extData, groupId, categoryId: adapter.categoryId, physicalProductId: primary });
        }
      }
      if (toCreate.length) await tx.tcgProduct.createMany({ data: toCreate });
      // Enlaces carta <-> producto: se reemplazan solo los de las cartas importadas
      const ids = [...cards.keys()];
      // Se reemplazan los enlaces hacia productos de ESTE bloque; los de otros bloques se conservan
      const removed = await tx.tcgProductPhysicalProduct.deleteMany({ where: { productId: { in: ids }, physicalProduct: { blockId: block.id } } });
      const links = [];
      for (const [id, c] of cards) for (const n of c.products) links.push({ productId: id, physicalProductId: productId.get(n) });
      await tx.tcgProductPhysicalProduct.createMany({ data: links, skipDuplicates: true });
      // Productos del bloque que quedaron sin ninguna carta
      const emptyProducts = await tx.tcgPhysicalProduct.findMany({
        where: { categoryId: adapter.categoryId, blockId: block.id, productLinks: { none: {} }, products: { none: {} } },
        select: { id: true, name: true },
      });
      let pruned = 0;
      if (flag('prune-empty-products') && emptyProducts.length) {
        pruned = (await tx.tcgPhysicalProduct.deleteMany({ where: { id: { in: emptyProducts.map((p) => p.id) } } })).count;
      }
      return { actualizadas: updated, cartasDeOtroBloqueSoloEnlazadas: skippedOtherBlock, creadas: toCreate.length, enlacesEliminados: removed.count, enlacesCreados: links.length, productosVaciosDelBloque: emptyProducts.length, productosVaciosBorrados: pruned };
    }, { timeout: 600000, maxWait: 60000 });

    console.log('IMPORTADO.\n');
    console.log(JSON.stringify({ plan, resultado: result }, null, 1));
    if (opt('report')) fs.writeFileSync(opt('report'), JSON.stringify({ plan, resultado: result }, null, 1));
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
