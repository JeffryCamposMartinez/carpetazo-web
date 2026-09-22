const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const oldLine1 = "const { mylType, mylRace, mylFrequency, mylCost } = req.query;";
const newLine1 = "const { mylType, mylRace, mylFrequency, mylCost, physicalProductId } = req.query;";

const oldBlock = "let whereClause = { categoryId: parseInt(categoryId) };";
const newBlock = "let whereClause = { categoryId: parseInt(categoryId) };\n    if (physicalProductId) whereClause.physicalProductId = parseInt(physicalProductId);";

code = code.replace(oldLine1, newLine1);
code = code.replace(oldBlock, newBlock);

fs.writeFileSync('server.js', code);
console.log("Fixed physicalProductId in /api/tcg/:categoryId/:groupId/products");
