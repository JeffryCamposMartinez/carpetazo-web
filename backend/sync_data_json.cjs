const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const basePath = 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Mitos_y_Leyendas';
// Block mappings based on server.js (Primer Bloque is 2, Furia is 1, Primera Era is 3, Imperio is 4)
const dbs = {
    'Furia_Extendido_DB': 1,
    'Primera_Era_DB': 3,
    'Imperio_DB': 4
};

async function getNextGroupId() {
    const lastGroup = await prisma.tcgGroup.findFirst({
        orderBy: { groupId: 'desc' },
        select: { groupId: true }
    });
    return (lastGroup?.groupId || 0) + 1;
}

async function getFiles(dir) {
    let results = [];
    const list = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const file of list) {
        const res = path.resolve(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(await getFiles(res));
        } else if (file.name === 'data.json') {
            results.push(res);
        }
    }
    return results;
}

async function main() {
    console.log("Sincronizando Groups y Products directamente desde los data.json...");

    // Caches to avoid querying the DB thousands of times
    const groupCache = new Map(); // "blockId-editionName" -> groupId
    const productCache = new Map(); // "blockId-productName" -> productId

    // Load existing Groups
    const existingGroups = await prisma.tcgGroup.findMany({ select: { groupId: true, name: true, blockId: true } });
    for (const g of existingGroups) {
        groupCache.set(`${g.blockId}-${g.name}`, g.groupId);
    }

    // Load existing Physical Products
    const existingProducts = await prisma.tcgPhysicalProduct.findMany({ select: { id: true, name: true, blockId: true } });
    for (const p of existingProducts) {
        productCache.set(`${p.blockId}-${p.name}`, p.id);
    }

    const updates = [];

    for (const [dbFolder, blockId] of Object.entries(dbs)) {
        const dataDir = path.join(basePath, dbFolder, dbFolder.replace('_DB', '_Data'));
        if (!fs.existsSync(dataDir)) continue;

        console.log(`Escaneando JSONs en ${dbFolder}...`);
        const jsonFiles = await getFiles(dataDir);
        
        for (const file of jsonFiles) {
            const raw = await fs.promises.readFile(file, 'utf8');
            let data;
            try {
                data = JSON.parse(raw);
            } catch (e) {
                console.error(`Error parseando JSON: ${file}`);
                continue;
            }

            const cardId = data.id;
            const editionName = data.edition?.name || 'Desconocida';
            const productName = data.productName;

            // 1. Resolve Edition (Group)
            const groupKey = `${blockId}-${editionName}`;
            let groupId = groupCache.get(groupKey);
            if (!groupId) {
                groupId = await getNextGroupId();
                await prisma.tcgGroup.create({
                    data: {
                        groupId,
                        name: editionName,
                        blockId,
                        categoryId: 99,
                        publishedOn: new Date(),
                        modifiedOn: new Date()
                    }
                });
                groupCache.set(groupKey, groupId);
                console.log(`[+] Creada Edicion: ${editionName}`);
            }

            // 2. Resolve Product
            let physicalProductId = null;
            if (productName && productName !== 'Generales') {
                const productKey = `${blockId}-${productName}`;
                physicalProductId = productCache.get(productKey);
                if (!physicalProductId) {
                    const newProd = await prisma.tcgPhysicalProduct.create({
                        data: {
                            name: productName,
                            blockId
                        }
                    });
                    physicalProductId = newProd.id;
                    productCache.set(productKey, physicalProductId);
                    console.log(`[+] Creado Producto: ${productName}`);
                }
            }

            // 3. Queue Update
            updates.push({
                cardId,
                groupId,
                physicalProductId
            });
        }
    }

    console.log(`Aplicando ${updates.length} actualizaciones de cartas a la base de datos...`);
    
    // Batch updates en paralelo
    let count = 0;
    for (let i = 0; i < updates.length; i += 500) {
        const chunk = updates.slice(i, i + 500);
        await Promise.all(chunk.map(update => 
            prisma.tcgProduct.update({
                where: { productId: update.cardId },
                data: {
                    groupId: update.groupId,
                    physicalProductId: update.physicalProductId
                }
            }).catch(() => null)
        ));
        count += chunk.length;
        console.log(`Progreso: ${count} / ${updates.length}`);
    }

    console.log("Limpiando Groups y Products huerfanos que quedaron vacios...");
    
    // Delete orphan Groups
    const groupCardCounts = await prisma.tcgProduct.groupBy({
        by: ['groupId'],
        _count: { productId: true }
    });
    const usedGroupIds = new Set(groupCardCounts.map(g => g.groupId));
    let deletedGroups = 0;
    for (const g of existingGroups) {
        if (!usedGroupIds.has(g.groupId)) {
            await prisma.tcgGroup.delete({ where: { groupId: g.groupId } }).catch(()=>null);
            deletedGroups++;
        }
    }

    // Delete orphan Products
    const prodCardCounts = await prisma.tcgProduct.groupBy({
        by: ['physicalProductId'],
        _count: { productId: true },
        where: { physicalProductId: { not: null } }
    });
    const usedProdIds = new Set(prodCardCounts.map(p => p.physicalProductId));
    let deletedProds = 0;
    for (const p of existingProducts) {
        if (!usedProdIds.has(p.id)) {
            await prisma.tcgPhysicalProduct.delete({ where: { id: p.id } }).catch(()=>null);
            deletedProds++;
        }
    }

    console.log(`Eliminados ${deletedGroups} Ediciones basura y ${deletedProds} Productos basura.`);
    console.log("¡Sincronizacion perfecta finalizada!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
