const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProgress() {
  try {
    const totalGroups = await prisma.tcgGroup.count();
    
    let previousProcessed = 0;
    let previousTotal = 0;
    let lastEvent = "Esperando descargar siguiente expansion...";

    setInterval(async () => {
      try {
        const groupsWithProducts = await prisma.tcgProduct.groupBy({
          by: ['groupId'],
        });
        
        const processedGroupsCount = groupsWithProducts.length;
        const totalProducts = await prisma.tcgProduct.count();
        
        if (previousProcessed > 0 && processedGroupsCount > previousProcessed) {
          const timeStr = new Date().toLocaleTimeString('es-CL');
          lastEvent = `Pasando a la siguiente expansion a las ${timeStr}!`;
        }
        previousProcessed = processedGroupsCount;
        
        let newCardsText = "";
        if (previousTotal > 0) {
            const diff = totalProducts - previousTotal;
            if (diff > 0) {
                newCardsText = ` (+${diff} cartas descargadas recién)`;
            } else {
                newCardsText = ` (Sin cambios recientes)`;
            }
        }
        previousTotal = totalProducts;
        
        let percentage = ((processedGroupsCount / totalGroups) * 100).toFixed(2);
        
        const sizeResult = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) as size;`;
        const dbSize = sizeResult[0].size;
        
        const currentTime = new Date().toLocaleTimeString('es-CL');
        
        console.clear();
        console.log('\n======================================');
        console.log('>> MONITOR DE PROGRESO DE DESCARGA TCG');
        console.log('======================================\n');
        console.log(`Expansiones (Sets) Listas: ${processedGroupsCount} de ${totalGroups}`);
        console.log(`Progreso Estimado:         ${percentage}%`);
        console.log(`Cartas Guardadas en BD:    ${totalProducts.toLocaleString('es-CL')}${newCardsText}`);
        console.log(`Peso Actual en Servidor:   ${dbSize}`);
        console.log('--------------------------------------');
        console.log(`Ultimo Evento de Expansion:${lastEvent}`);
        console.log(`Hora de Actualizacion:     ${currentTime}`);
        console.log('\n(Actualizando cada 5 segundos... Presiona Ctrl+C para salir)');

      } catch (err) {
        console.error('Error al consultar BD:', err.message);
      }
    }, 5000);
    
  } catch (err) {
    console.error('Error inicial:', err);
  }
}

checkProgress();
