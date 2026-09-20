const fs = require('fs');
const file = 'C:/Users/Jeffry/Desktop/Carpetazo.cl/Publicar mis cartas/backend/insert_myl.cjs';
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the edition parsing logic
  const oldLogic = `                // Parse Edition
                const editionName = data.subtitle || "Edición Desconocida";
                if (!groupCache[editionName]) {
                    let group = await prisma.tcgGroup.findFirst({ where: { name: editionName, categoryId: MYL_CATEGORY_ID } });`;
                    
  const newLogic = `                // Parse Edition
                const rawProd = data.product || 'Otros';
                let editionName = rawProd;
                if (!editionName || editionName.includes('.webp') || editionName === 'uploads') editionName = 'Otros';
                if (editionName === 'ElReto') editionName = 'El Reto';
                if (editionName === 'primer bloque') editionName = 'Otros';
                
                // Extract block from URL
                let parsedBlockId = 3;
                const match = data.imageUrl?.match(/https:\\/\\/cdn\\.mazos\\.cl\\/([^\\/]+)\\//);
                if (match) {
                    if (match[1] === 'FURIA_EXT') parsedBlockId = 1;
                    else if (match[1] === 'PRIMER_BLOQUE') parsedBlockId = 2;
                    else if (match[1] === 'PRIMERA_ERA') parsedBlockId = 3;
                    else if (match[1] === 'cards' && data.imageUrl.includes('primer-bloque')) parsedBlockId = 2;
                }
                
                const groupKey = \`\${parsedBlockId}|\${editionName}\`;
                
                if (!groupCache[groupKey]) {
                    let group = await prisma.tcgGroup.findFirst({ where: { name: editionName, blockId: parsedBlockId, categoryId: MYL_CATEGORY_ID } });`;

  // We also need to change how groupCache stores the groupId
  // Let's replace groupCache assignments
  content = content.replace(oldLogic, newLogic);
  content = content.replace('groupCache[editionName] = group.groupId;', 'groupCache[groupKey] = group.groupId;');
  content = content.replace('groupId: groupCache[editionName],', 'groupId: groupCache[groupKey],');
  content = content.replace('blockId: block.id,', 'blockId: parsedBlockId,');

  fs.writeFileSync(file, content, 'utf8');
  console.log('insert_myl.cjs patched');
}
