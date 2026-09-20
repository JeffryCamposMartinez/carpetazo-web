fetch('http://localhost:3000/api/tcg/search?q=oseye&categoryId=99&blockId=2')
  .then(r => r.json())
  .then(data => {
      console.log("Total returned:", data.data?.length);
      if(data.data) {
          console.log(data.data.map(c => c.productId + " " + c.name + " " + c.groupId));
      } else {
          console.log(data);
      }
  }).catch(console.error);
