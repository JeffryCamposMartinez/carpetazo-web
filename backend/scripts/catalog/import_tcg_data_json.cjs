const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const get = (n, fallback) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : fallback; };
const apply = args.includes('--apply');
const root = get('root', 'C:\\Users\\Jeffry\\Desktop\\TcgplayerUpdate\\Descargas');
const clean = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const chunks = (a, n) => { const out=[]; for(let i=0;i<a.length;i+=n) out.push(a.slice(i,i+n)); return out; };

function scan() {
  const games = new Map(), sets = new Map(), cards = new Map(), errors = [];
  for (const gameDir of fs.readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory())) {
    const dbDirs = fs.readdirSync(path.join(root, gameDir.name), { withFileTypes: true }).filter(e => e.isDirectory() && /_DB$/i.test(e.name));
    for (const db of dbDirs) {
      const baseName = db.name.replace(/_DB$/i, '');
      const dataRoots = [`${baseName}_Data`, `${baseName}_Productos_Data`].map(name => path.join(root, gameDir.name, db.name, name)).filter(fs.existsSync);
      if (!dataRoots.length) continue;
      const files = [];
      const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.isFile() && e.name.toLowerCase()==='data.json') files.push(p); } };
      dataRoots.forEach(walk);
      for (const file of files) {
        try {
          const j=read(file); const categoryId=Number(j.categoryId), productId=Number(j.productId), set=j.set;
          if(!Number.isInteger(categoryId)||!Number.isInteger(productId)||!set||!Number.isInteger(Number(set.groupId))) throw new Error('categoryId/productId/set.groupId inválido');
          games.set(categoryId,{categoryId,name:j.game||gameDir.name,folder:gameDir.name});
          sets.set(Number(set.groupId),{groupId:Number(set.groupId),categoryId,name:String(set.name||''),folder:String(set.name||'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_|_$/g,''),abbreviation:set.abbreviation||null,publishedOn:set.publishedOn?new Date(set.publishedOn):null,modifiedOn:set.modifiedOn?new Date(set.modifiedOn):null});
          cards.set(productId,{productId,categoryId,groupId:Number(set.groupId),kind:j.kind==='product'?'product':'card',name:String(j.name||'').trim(),cleanName:clean(j.cleanName||j.name),number:j.number||null,rarity:j.rarity||null,folder:path.basename(path.dirname(file)),imageKey:null,thumbKey:null,dataKey:null,sourceImageUrl:null,tcgplayerUrl:null,attributes:j.attributes||null,modifiedOn:j.modifiedOn?new Date(j.modifiedOn):null});
        } catch(e) { errors.push({file,error:e.message}); }
      }
    }
  }
  return {games:[...games.values()],sets:[...sets.values()],cards:[...cards.values()],errors};
}

(async()=>{ const data=scan(); console.log(`TCG encontrados: ${data.games.length}`); console.log(`Ediciones: ${data.sets.length}`); console.log(`Registros cartas/productos: ${data.cards.length}`); console.log(`Errores de lectura: ${data.errors.length}`); const kinds={card:0,product:0}; data.cards.forEach(c=>kinds[c.kind]++); console.log(`Cartas: ${kinds.card} | Productos: ${kinds.product}`); if(!apply){console.log('SIMULACIÓN: no se escribió en la base. Usa --apply para aplicar.'); return;}
  const prisma=new PrismaClient(); try { await prisma.$transaction(async tx=>{
    for(const g of data.games) await tx.catalogGame.upsert({where:{categoryId:g.categoryId},create:g,update:{name:g.name,folder:g.folder}});
    for(const s of data.sets) await tx.catalogSet.upsert({where:{groupId:s.groupId},create:s,update:{categoryId:s.categoryId,name:s.name,folder:s.folder,abbreviation:s.abbreviation,publishedOn:s.publishedOn,modifiedOn:s.modifiedOn}});
    for(const batch of chunks(data.cards,2000)) await tx.catalogCard.createMany({data:batch,skipDuplicates:true});
  },{timeout:600000,maxWait:10000}); console.log(`IMPORTACIÓN TERMINADA: ${data.cards.length} registros procesados.`); } finally { await prisma.$disconnect(); }
})().catch(e=>{console.error('ERROR:',e.message);process.exitCode=1;});
