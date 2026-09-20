const fs = require('fs');
const metadataStr = fs.readFileSync('C:/Users/Jeffry/Desktop/Carpetazo.cl/metadata_pb.json', 'utf8');
const metadata = JSON.parse(metadataStr);

const editions = new Set();
const products = new Set();

metadata.forEach(c => {
    if (c.edition) editions.add(c.edition.name);
    if (c.subtitle) products.add(c.subtitle);
});

console.log("Editions:", Array.from(editions));
console.log("Total Products:", products.size);
