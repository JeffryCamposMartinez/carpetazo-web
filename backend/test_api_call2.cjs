const http = require('http');

http.get('http://localhost:8000/api/tcg/search?categoryId=99&blockId=2&physicalProductId=141', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log("Raw response:", data);
  });
}).on('error', (err) => {
  console.log("Error:", err.message);
});
