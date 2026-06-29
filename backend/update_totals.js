const fs = require('fs');
const https = require('https');

const dataPath = './data.json';
const cards = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

async function updateCards() {
    for (let card of cards) {
        if (!card.total || card.total === '???') {
            console.log('Fetching', card.id);
            await new Promise((resolve) => {
                https.get('https://api.pokemontcg.io/v2/cards?q=id:' + card.id, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.data && json.data.length > 0) {
                                const c = json.data[0];
                                card.number = c.number;
                                card.total = c.set.printedTotal;
                                console.log('Updated', card.id, card.number, '/', card.total);
                            }
                        } catch(e) {
                            console.error(e);
                        }
                        resolve();
                    });
                }).on('error', (e) => {
                    console.error(e);
                    resolve();
                });
            });
            // sleep to avoid rate limit
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    fs.writeFileSync(dataPath, JSON.stringify(cards, null, 2));
    console.log('Done!');
}
updateCards();
