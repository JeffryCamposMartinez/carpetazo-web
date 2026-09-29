const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const dbArg = process.argv.find(a => a.startsWith('--db='));
const selectedFolders = dbArg ? dbArg.split('=')[1].split(',') : [];

if (selectedFolders.length === 0) {
    console.error('Uso: node upload_pokemon.cjs --db=Folder1,Folder2');
    process.exit(1);
}

const CATEGORY_ID = 1;
const basePath = 'C:\\Users\\Jeffry\\Desktop\\CarpetazoUpdater\\Descargas\\Pokemon';

async function getFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return Array.prototype.concat(...files);
}

let nextGroupId = null;
async function getNextGroupId() {
    if (nextGroupId !== null) {
        nextGroupId += 1;
        return nextGroupId;
    }
    const lastGroup = await prisma.tcgGroup.findFirst({ orderBy: { groupId: 'desc' }, select: { groupId: true } });
    nextGroupId = (lastGroup?.groupId || 0) + 1;
    return nextGroupId;
}

const groupCache = new Map();
async function getOrCreateGroup(setName) {
    if (groupCache.has(setName)) return groupCache.get(setName);
    let group = await prisma.tcgGroup.findFirst({ where: { categoryId: CATEGORY_ID, name: setName } });
    if (!group) {
        const groupId = await getNextGroupId();
        group = await prisma.tcgGroup.create({
            data: {
                groupId,
                categoryId: CATEGORY_ID,
                name: setName,
                publishedOn: new Date(),
                modifiedOn: new Date()
            }
        });
        console.log(`Grupo creado: ${setName} (#${groupId})`);
    }
    groupCache.set(setName, group);
    return group;
}

async function run() {
    console.log(`Iniciando subida a BD para Pokemon. Carpetas: ${selectedFolders.join(', ')}`);
    
    const category = await prisma.tcgCategory.findUnique({ where: { categoryId: CATEGORY_ID } });
    if (!category) {
        await prisma.tcgCategory.create({
            data: { categoryId: CATEGORY_ID, name: 'Pokemon', modifiedOn: new Date() }
        });
        console.log('Categoria Pokemon creada (ID: 1).');
    }

    for (const folder of selectedFolders) {
        const dataRoot = path.join(basePath, folder, 'Data');
        console.log(`Escaneando ${dataRoot}...`);
        
        const files = (await getFiles(dataRoot)).filter(f => f.endsWith('data.json'));
        console.log(`Encontrados ${files.length} data.json.`);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const json = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (!json.id || !json.name) continue;

                const productId = String(json.id);
                const cardName = json.name;
                const setName = json.set?.name || 'Desconocido';

                const group = await getOrCreateGroup(setName);

                const relativeParts = file.substring(dataRoot.length + 1).replace(/\\/g, '/').split('/');
                const pokemonNameDir = relativeParts[relativeParts.length - 2]; 
                const imagePath = `Carpetazo.cl/Pokemon/${folder}/Images/${setName}/${pokemonNameDir}/${pokemonNameDir}.webp`;
                const imageUrl = `${process.env.R2_PUBLIC_URL}/${encodeURI(imagePath)}`;

                await prisma.tcgProduct.upsert({
                    where: { productId },
                    create: {
                        productId,
                        groupId: group.groupId,
                        categoryId: CATEGORY_ID,
                        name: cardName,
                        cleanName: cardName.toLowerCase(),
                        imageUrl,
                        extData: json
                    },
                    update: {
                        groupId: group.groupId,
                        categoryId: CATEGORY_ID,
                        name: cardName,
                        cleanName: cardName.toLowerCase(),
                        imageUrl,
                        extData: json
                    }
                });

                if ((i + 1) % 100 === 0) console.log(`Progreso: ${i + 1} / ${files.length}`);
            } catch (err) {
                console.error(`Error procesando ${file}: ${err.message}`);
            }
        }
    }
    console.log('¡Subida a BD completada!');
}

run().catch(console.error).finally(() => prisma.$disconnect());
