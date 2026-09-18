const fs = require("fs");
let code = fs.readFileSync("server.js", "utf8");

// 1. Add checkIfSealed
const checkIfSealedFunc = `
const checkIfSealed = (product) => {
  if (!product || !product.name) return false;
  const nameLower = product.name.toLowerCase();
  const sealedKeywords = ['booster box', 'booster pack', ' pack', ' deck', ' tin', 'blister', 'display', 'box set', 'collection box', 'elite trainer box', 'special edition'];
  if (sealedKeywords.some(kw => nameLower.includes(kw))) return true;

  const hasNumber = product.extendedData && product.extendedData.some(d => d.name === 'Number');
  const hasRarity = product.extendedData && product.extendedData.some(d => d.name === 'Rarity');
  if (!hasNumber && !hasRarity) return true;

  return false;
};
`;

if (!code.includes("checkIfSealed")) {
  code = code.replace("const uploadToDrive = async", checkIfSealedFunc + "\nconst uploadToDrive = async");
}

// 2. Modify uploadToDrive for subfolders
code = code.replace(
  'const rootFolderId = await getOrCreateDriveFolder();\n                const catFolderId = await getOrCreateSubFolder(catName, rootFolderId);\n                const groupFolderId = await getOrCreateSubFolder(groupName, catFolderId);\n\n                const uploadedFile = await drive.files.create({\n                  resource: {\n                    name: product.productId + \'.jpg\',\n                    parents: [groupFolderId],',
  `const isSealed = checkIfSealed(product);
                const subFolderName = isSealed ? 'Sellados' : 'Cartas';
                const rootFolderId = await getOrCreateDriveFolder();
                const catFolderId = await getOrCreateSubFolder(catName, rootFolderId);
                const groupFolderId = await getOrCreateSubFolder(groupName, catFolderId);
                const finalFolderId = await getOrCreateSubFolder(subFolderName, groupFolderId);

                const uploadedFile = await drive.files.create({
                  resource: {
                    name: product.productId + '.jpg',
                    parents: [finalFolderId],`
);

code = code.replace(
  'const rootFolderId = await getOrCreateDriveFolder();\n          const catFolderId = await getOrCreateSubFolder(catName, rootFolderId);\n          const groupFolderId = await getOrCreateSubFolder(groupName, catFolderId);\n          \n          const fileMetadata = {\n            name: product.productId + \'.jpg\',\n            parents: [groupFolderId],\n            description: `TCG Card: ` + product.name + `\\nJuego: ` + catName + `\\nExpansión: ` + groupName + `\\nID: ` + product.productId\n          };',
  `const isSealed = checkIfSealed(product);
          const subFolderName = isSealed ? 'Sellados' : 'Cartas';
          const rootFolderId = await getOrCreateDriveFolder();
          const catFolderId = await getOrCreateSubFolder(catName, rootFolderId);
          const groupFolderId = await getOrCreateSubFolder(groupName, catFolderId);
          const finalFolderId = await getOrCreateSubFolder(subFolderName, groupFolderId);
          
          const fileMetadata = {
            name: product.productId + '.jpg',
            parents: [finalFolderId],
            description: \`TCG Card: \` + product.name + \`\\nJuego: \` + catName + \`\\nExpansión: \` + groupName + \`\\nID: \` + product.productId
          };`
);

// 3. Upload datos_expansion.json
const oldGroupFinishLogic = `if (isDownloading) {
           progress.groupIdx++;
           progress.productIdx = 0;
           progress.productsCache = [];
           saveProgress();
        }`;

const newGroupFinishLogic = `if (isDownloading && progress.productIdx >= progress.productsCache.length && progress.productsCache.length > 0) {
           try {
             const rootFolderId = await getOrCreateDriveFolder();
             const catFolderId = await getOrCreateSubFolder(currentCategoryName, rootFolderId);
             const groupFolderId = await getOrCreateSubFolder(currentGroupName, catFolderId);
             
             const existing = await drive.files.list({
               q: "name='datos_expansion.json' and '" + groupFolderId + "' in parents and trashed=false",
               fields: 'files(id)'
             });
             
             if (existing.data.files.length === 0) {
                 await drive.files.create({
                   resource: { name: 'datos_expansion.json', parents: [groupFolderId] },
                   media: { mimeType: 'application/json', body: JSON.stringify(progress.productsCache, null, 2) },
                   fields: 'id'
                 });
                 console.log("Subido datos_expansion.json para " + currentGroupName);
             }
           } catch (e) {
             console.error("Error subiendo datos_expansion.json para " + currentGroupName, e);
           }

           progress.groupIdx++;
           progress.productIdx = 0;
           progress.productsCache = [];
           saveProgress();
        }`;

if (!code.includes("datos_expansion.json")) {
  code = code.replace(oldGroupFinishLogic, newGroupFinishLogic);
}

fs.writeFileSync("server.js", code);
