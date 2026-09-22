const express = require('express');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();
const app = express();
const port = 3005;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/local-images', express.static('C:/Users/Jeffry/Desktop/CarpetazoUpdater/Primer_Bloque_DB'));

const TARGET_GROUPS = [999991, 999992, 999993, 999994, 999995];
let historyStack = [];

app.get('/', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public_classifier.html'));
});

// Cambiado a POST para poder recibir el array de excludeIds en el body
app.post('/api/next-batch', async (req, res) => {
    try {
        const excludeIds = req.body.excludeIds || [];

        const remaining = await prisma.tcgProduct.count({
            where: { categoryId: 99, groupId: { notIn: TARGET_GROUPS } }
        });

        if (remaining === 0) {
            return res.json({ done: true, cards: [], remaining: 0 });
        }

        let nextCards = await prisma.tcgProduct.findMany({
            where: { 
                categoryId: 99, 
                groupId: { notIn: TARGET_GROUPS },
                productId: { notIn: excludeIds }
            },
            include: { group: true },
            take: 25 // Traemos 25 para rellenar rápido
        });

        const baseUrlR2 = "https://pub-1ba0fdf5c93c4412abbc2b234780b3c6.r2.dev/Carpetazo.cl/Mitos_y_Leyendas/Primer_Bloque_DB/";
        nextCards = nextCards.map(c => {
            if (c.imageUrl && c.imageUrl.startsWith(baseUrlR2)) {
                c.localImageUrl = c.imageUrl.replace(baseUrlR2, '/local-images/');
            } else {
                c.localImageUrl = c.imageUrl;
            }
            return c;
        });

        res.json({ cards: nextCards, remaining, historyCount: historyStack.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/classify', async (req, res) => {
    try {
        const { productId, groupId } = req.body;
        
        const card = await prisma.tcgProduct.findUnique({ where: { productId } });
        if (card) {
            historyStack.push({ productId, oldGroupId: card.groupId });
        }

        await prisma.tcgProduct.update({
            where: { productId },
            data: { groupId }
        });
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/undo', async (req, res) => {
    try {
        if (historyStack.length === 0) return res.json({ success: false });
        
        const lastAction = historyStack.pop();
        const card = await prisma.tcgProduct.findUnique({ where: { productId: lastAction.productId }, include: { group: true } });
        
        await prisma.tcgProduct.update({
            where: { productId: lastAction.productId },
            data: { groupId: lastAction.oldGroupId }
        });

        const baseUrlR2 = "https://pub-1ba0fdf5c93c4412abbc2b234780b3c6.r2.dev/Carpetazo.cl/Mitos_y_Leyendas/Primer_Bloque_DB/";
        let localImg = card.imageUrl;
        if (localImg && localImg.startsWith(baseUrlR2)) {
            localImg = localImg.replace(baseUrlR2, '/local-images/');
        }
        card.localImageUrl = localImg;

        res.json({ success: true, card });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`✅ Clasificador v2 iniciado en http://localhost:${port}`);
});
