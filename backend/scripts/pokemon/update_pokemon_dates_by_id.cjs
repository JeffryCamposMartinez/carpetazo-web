const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Fetching sets metadata from TCGdex...');
  const res = await fetch('https://api.tcgdex.net/v2/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ sets { id releaseDate } }' })
  });
  const data = await res.json();
  const sets = data.data.sets;

  const mapping = {};
  for (const s of sets) {
    if (s.releaseDate) {
      mapping[s.id] = new Date(s.releaseDate);
    }
  }

  console.log('Updating TcgGroup dates in database based on set.id...');
  const groups = await prisma.tcgGroup.findMany({ where: { categoryId: 1 } });
  
  let updated = 0;
  for (const g of groups) {
    const card = await prisma.tcgProduct.findFirst({ where: { groupId: g.groupId } });
    if (!card || !card.extData || !card.extData.set || !card.extData.set.id) continue;
    
    const setId = card.extData.set.id;
    const match = mapping[setId];
    if (match) {
      await prisma.tcgGroup.update({
        where: { groupId: g.groupId },
        data: { publishedOn: match }
      });
      updated++;
    } else {
        console.log('No match for set ID:', setId);
    }
  }
  
  console.log('Updated ' + updated + ' of ' + groups.length + ' sets.');
}
run().catch(console.error).finally(() => prisma.$disconnect());
