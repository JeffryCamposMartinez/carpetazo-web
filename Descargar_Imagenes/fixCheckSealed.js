const fs = require("fs");
let code = fs.readFileSync("server.js", "utf8");

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

if (!code.includes("const checkIfSealed")) {
  code = code.replace("const uploadToDrive = (url", checkIfSealedFunc + "\nconst uploadToDrive = (url");
  fs.writeFileSync("server.js", code);
}
