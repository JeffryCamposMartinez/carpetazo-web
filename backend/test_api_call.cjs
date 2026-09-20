const http = require('http');

http.get('http://localhost:8000/api/tcg/search?categoryId=99&blockId=2&physicalProductId=141', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log("Total returned:", json.data.length);
    if (json.data.length > 0) {
      console.log("First card physicalProductId:", json.data[0].physicalProductId);
    }
  });
}).on('error', (err) => {
  console.log("Error:", err.message);
});
