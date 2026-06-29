const https = require('https');
https.get('https://tcgmatch.cl/', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    // Find all links
    const matches = body.match(/href="([^"]+)"/g);
    if (matches) {
      console.log(matches.slice(0, 50));
    }
    // Find inputs
    const inputs = body.match(/<input[^>]+name="([^"]+)"/g);
    console.log(inputs);
  });
});
