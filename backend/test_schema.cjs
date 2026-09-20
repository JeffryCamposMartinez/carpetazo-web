async function run() {
  const query = `
    query {
      __schema {
        queryType {
          fields {
            name
          }
        }
      }
    }
  `;
  try {
    const res = await fetch('https://api.mazos.cl/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 4mqbmG_TfeaE_yiboPkhgk9-AM2SmFD20K8fiZi4cB0'
        },
        body: JSON.stringify({ query })
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.__schema.queryType.fields.map(f => f.name), null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
