const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Fetching sets metadata from TCGdex...');
  const res = await fetch('https://api.tcgdex.net/v2/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ sets { id name releaseDate } }' })
  });
  const data = await res.json();
  const sets = data.data.sets;

  const mapping = {};
  for (const s of sets) {
    if (s.releaseDate) {
      mapping[s.name.toLowerCase()] = new Date(s.releaseDate);
    }
  }

  // Also fetch spanish names
  const resEs = await fetch('https://api.tcgdex.net/v2/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'accept-language': 'es-ES' },
    body: JSON.stringify({ query: '{ sets { id name releaseDate } }' })
  });
  const dataEs = await resEs.json();
  for (const s of dataEs.data.sets) {
    if (s.releaseDate) {
      mapping[s.name.toLowerCase()] = new Date(s.releaseDate);
    }
  }

  console.log('Updating TcgGroup dates in database...');
  const groups = await prisma.tcgGroup.findMany({ where: { categoryId: 1 } });
  
  let updated = 0;
  for (const g of groups) {
    const match = mapping[g.name.toLowerCase()];
    if (match) {
      await prisma.tcgGroup.update({
        where: { groupId: g.groupId },
        data: { publishedOn: match }
      });
      updated++;
    }
  }
  
  console.log('Updated ' + updated + ' of ' + groups.length + ' sets.');
}
run().catch(console.error).finally(() => prisma.$disconnect());
