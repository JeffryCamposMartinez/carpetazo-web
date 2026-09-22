const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const baseDir = "C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Primer_Bloque_DB";

// Reemplaza esto con el dominio público de tu R2
const R2_BASE_URL = "https://pub-1ba0fdf5c93c4412abbc2b234780b3c6.r2.dev"; 
const R2_PREFIX = "/Carpetazo.cl/Mitos_y_Leyendas/Primer_Bloque_DB";

async function main() {
    console.log("Iniciando migración de DB desde:", baseDir);
    
    if (!fs.existsSync(baseDir)) {
        console.log("La carpeta no existe:", baseDir);
        return;
    }

    let addedGroups = 0;
    let addedProducts = 0;
    let updatedProducts = 0;
    
    // Cache de grupos
    const groupCache = {};
    const existingGroups = await prisma.tcgGroup.findMany({ where: { categoryId: 99 } });
    
    let maxGroupId = 999200;
    for (const g of existingGroups) {
        groupCache[g.name] = g.groupId;
        if (g.groupId > maxGroupId) maxGroupId = g.groupId;
    }
    
    const existingProducts = await prisma.tcgProduct.findMany({ select: { productId: true } });
    const productIds = new Set(existingProducts.map(p => p.productId));

    function walk(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                results = results.concat(walk(filePath));
            } else if (file === 'data.json') {
                results.push(filePath);
            }
        }
        return results;
    }

    function stripEmojis(name) {
        if (!name) return name;
        return name.replace(/[^\w\s\-\.\u00C0-\u017F]/g, '').trim().replace(/\s+/g, ' ');
    }

    const allDataFiles = walk(baseDir);
    console.log(`Se encontraron ${allDataFiles.length} cartas para procesar...`);

    for (const dataPath of allDataFiles) {
        try {
            const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
            const productId = data.id;
            
            // Obtener el nombre del producto (carpeta padre de la carta)
            const cardFolder = path.dirname(dataPath); // ej: .../Primer_Bloque_DB/Display/Ganimedes
            const productFolder = path.dirname(cardFolder); // ej: .../Primer_Bloque_DB/Display
            const productName = path.basename(productFolder); // ej: Display
            const cardFolderName = path.basename(cardFolder); // ej: Ganimedes
            
            let groupName = "Primer Bloque";
            
            if (data.edition && data.edition.name) {
                groupName = stripEmojis(data.edition.name);
            } else if (data.collectorCode) {
                groupName = stripEmojis(data.collectorCode.replace(/(?:[-\s]+)\d+[\/\-\d]*\s*[A-Z]*$/, '').trim());
            } else {
                groupName = stripEmojis(productName !== 'Primer_Bloque_DB' ? productName : 'Primer Bloque');
            }
            
            let groupId = groupCache[groupName];
            
            if (!groupId) {
                maxGroupId++;
                const newGroup = await prisma.tcgGroup.create({
                    data: {
                        groupId: maxGroupId,
                        categoryId: 99,
                        name: groupName,
                        blockId: 2, // 2 = Primer Bloque en tu DB
                        publishedOn: new Date(),
                        modifiedOn: new Date()
                    }
                });
                groupId = newGroup.groupId;
                groupCache[groupName] = groupId;
                addedGroups++;
                console.log(`[+] Creada nueva Edición/Producto: ${groupName} (groupId: ${groupId})`);
            }
            
            const cleanName = data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "");
            
            // Reconstruir los atributos para extData
            const extData = [];
            if (data.type) extData.push({ name: 'Type', value: data.type });
            if (data.cost !== undefined && data.cost !== null) extData.push({ name: 'Cost', value: data.cost.toString() });
            if (data.attack !== undefined && data.attack !== null) extData.push({ name: 'Fuerza', value: data.attack.toString() });
            if (data.race && Array.isArray(data.race) && data.race.length > 0) extData.push({ name: 'Race', value: data.race.join(", ") });
            else if (data.race && typeof data.race === 'string') extData.push({ name: 'Race', value: data.race });
            if (data.effect) extData.push({ name: 'Effect', value: data.effect });
            if (data.edition && data.edition.name) extData.push({ name: 'Edition', value: data.edition.name });
            if (data.frequency) extData.push({ name: 'Frequency', value: data.frequency });
            if (data.collectorCode) extData.push({ name: 'Number', value: data.collectorCode });
            
            // Buscar la imagen real
            const filesInCardDir = fs.readdirSync(cardFolder);
            const imageFile = filesInCardDir.find(f => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.png'));
            
            if (!imageFile) continue;

            // Generar URL pública de R2
            // R2_BASE_URL + /Carpetazo.cl/Mitos_y_Leyendas/Primer_Bloque_DB/Nombre_Producto/Nombre_Carta/imagen.webp
            const newUrl = `${R2_BASE_URL}${R2_PREFIX}/${encodeURIComponent(productName)}/${encodeURIComponent(cardFolderName)}/${encodeURIComponent(imageFile)}`;
            
            if (productIds.has(productId)) {
                // Actualizar carta existente con la nueva imagen de R2 y nueva metadata (edition)
                await prisma.tcgProduct.update({
                    where: { productId: productId },
                    data: {
                        imageUrl: newUrl,
                        extData: extData,
                        groupId: groupId
                    }
                });
                updatedProducts++;
            } else {
                // Insertar nueva carta
                await prisma.tcgProduct.create({
                    data: {
                        productId: productId,
                        categoryId: 99, // Mitos y Leyendas
                        name: data.name,
                        cleanName: cleanName,
                        imageUrl: newUrl,
                        extData: extData,
                        groupId: groupId
                    }
                });
                productIds.add(productId);
                addedProducts++;
            }
            
            if ((addedProducts + updatedProducts) % 500 === 0) {
                console.log(`Progreso: ${addedProducts + updatedProducts} cartas procesadas...`);
            }
            
        } catch (e) {
            console.error(`Error procesando carta: ${e.message}`);
        }
    }
    
    console.log(`\n¡Sincronización a R2 completada!`);
    console.log(`Nuevas ediciones creadas: ${addedGroups}`);
    console.log(`Cartas nuevas insertadas: ${addedProducts}`);
    console.log(`Cartas existentes actualizadas a R2: ${updatedProducts}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
