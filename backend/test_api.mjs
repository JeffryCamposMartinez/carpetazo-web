import fetch from 'node-fetch';

async function testSearch() {
  const url = "https://api.carpetazo.cl/api/tcg/search?q=Aine";
  const res = await fetch(url);
  const json = await res.json();
  const aine = json.data.find(c => c.productId == 4397 || c.name === "Aine");
  if (aine) {
    console.log(aine.extData.effect);
  }
}
testSearch().catch(console.error);
