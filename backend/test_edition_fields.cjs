async function run() {
  const query = `
    query {
      __type(name: "Edition") {
        fields {
          name
          type {
            name
            kind
          }
        }
      }
    }
  `;
  try {
    const res = await fetch('https://api.mazos.cl/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer 4mqbmG_TfeaE_yiboPkhgk9-AM2SmFD20K8fiZi4cB0' },
        body: JSON.stringify({ query })
    });
    const data = await res.json();
    console.log("Edition fields:", JSON.stringify(data, null, 2));
  } catch(e) {}
}
run();
