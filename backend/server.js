const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const DATA_DIR = process.env.DATA_DIR || __dirname;

const dataPath = path.join(DATA_DIR, 'data.json');
const ordersPath = path.join(DATA_DIR, 'orders.json');
const historyPath = path.join(DATA_DIR, 'history.json');

// Helper to read data
const getCards = () => {
    try {
        const data = fs.readFileSync(dataPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

// Helper to write data
const saveCards = (cards) => {
    fs.writeFileSync(dataPath, JSON.stringify(cards, null, 2));
};

// Helper to read orders
const getOrders = () => {
    try {
        if (!fs.existsSync(ordersPath)) return {};
        const data = fs.readFileSync(ordersPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
};

// Helper to write orders
const saveOrders = (orders) => {
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
};

// Helper to read history
const getHistory = () => {
    try {
        if (!fs.existsSync(historyPath)) return [];
        const data = fs.readFileSync(historyPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};

// Helper to write history
const saveHistory = (history) => {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
};

// GET all cards
app.get('/api/cards', (req, res) => {
    const cards = getCards();
    res.json({
        success: true,
        data: cards
    });
});

// POST new card
app.post('/api/cards', (req, res) => {
    const { id, name, pseudoName, hp, price, stock, imageUrl, types, set, rarity, supertype, number, total, language } = req.body;
    
    if (!id || !name || price === undefined || stock === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const cards = getCards();
    
    // Check if card already exists
    const existingIndex = cards.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
        // Update stock and price
        cards[existingIndex].stock = parseInt(stock);
        cards[existingIndex].price = parseFloat(price);
    } else {
        // Add new card
        cards.push({
            id,
            name,
            pseudoName: pseudoName || '',
            hp: hp || 'N/A',
            price: parseFloat(price),
            stock: parseInt(stock),
            imageUrl,
            types: types || [],
            set: set || 'Unknown',
            rarity: rarity || 'Unknown',
            supertype: supertype || 'Unknown',
            number: number || req.body.number || id.split('-')[1] || '0',
            total: total || req.body.total || '???',
            language: language || req.body.language || 'English'
        });
    }

    saveCards(cards);
    
    res.json({ success: true, message: 'Card saved successfully' });
});

// POST update existing card stock and price
app.post('/api/cards/update', (req, res) => {
    const { id, price, stock } = req.body;
    
    if (!id || price === undefined || stock === undefined) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const cards = getCards();
    const existingIndex = cards.findIndex(c => c.id === id);
    
    if (existingIndex >= 0) {
        cards[existingIndex].stock = parseInt(stock);
        cards[existingIndex].price = parseFloat(price);
        saveCards(cards);
        res.json({ success: true, message: 'Card updated successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Card not found' });
    }
});

// POST delete a card
app.post('/api/cards/delete', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ success: false, message: 'Missing card ID' });
    }
    let cards = getCards();
    const initialLength = cards.length;
    cards = cards.filter(c => c.id !== id);
    if (cards.length < initialLength) {
        saveCards(cards);
        res.json({ success: true, message: 'Card deleted successfully' });
    } else {
        res.status(404).json({ success: false, message: 'Card not found' });
    }
});

// GET all pending orders
app.get('/api/orders', (req, res) => {
    const orders = getOrders();
    // Return them as an array mapped with the key as the code
    const orderList = Object.keys(orders).map(code => ({
        code,
        ...orders[code]
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Newest first
    
    res.json({ success: true, data: orderList });
});

// GET history
app.get('/api/history', (req, res) => {
    const history = getHistory();
    res.json({ success: true, data: history });
});

// POST create short order code
app.post('/api/orders/create', (req, res) => {
    const { orderItems, totalAmount } = req.body;
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
        return res.status(400).json({ success: false, message: 'Invalid order data' });
    }

    // Generate 5 char random alphanumeric code for easy reference
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const orders = getOrders();
    orders[code] = {
        items: orderItems,
        totalAmount: totalAmount || 0,
        createdAt: new Date().toISOString()
    };
    saveOrders(orders);

    res.json({ success: true, code });
});

// POST process order (discount stock using 10-digit code)
app.post('/api/process-order', (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ success: false, message: 'Missing order code' });
    }

    const orders = getOrders();
    const order = orders[code];
    
    if (!order) {
        return res.status(404).json({ success: false, message: 'Código de pedido no encontrado o ya procesado' });
    }

    const cards = getCards();
    
    order.items.forEach(item => {
        const existingIndex = cards.findIndex(c => c.id === item.id);
        if (existingIndex >= 0) {
            cards[existingIndex].stock = Math.max(0, cards[existingIndex].stock - item.q);
        }
    });

    saveCards(cards);
    
    // Add to history
    const history = getHistory();
    history.unshift({
        ...order,
        code,
        status: 'completed',
        processedAt: new Date().toISOString()
    });
    saveHistory(history);

    // Remove the order so it can't be processed twice
    delete orders[code];
    saveOrders(orders);
    
    res.json({ success: true, message: 'Order processed successfully' });
});

// POST reject order (just delete from pending list)
app.post('/api/reject-order', (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ success: false, message: 'Missing order code' });
    }

    const orders = getOrders();
    if (orders[code]) {
        // Add to history
        const history = getHistory();
        history.unshift({
            ...orders[code],
            code,
            status: 'rejected',
            processedAt: new Date().toISOString()
        });
        saveHistory(history);

        delete orders[code];
        saveOrders(orders);
    }
    
    res.json({ success: true, message: 'Order rejected successfully' });
});

// --- POKEMON TCG API PROXY CON CACHÉ ---
const tcgCache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hora en milisegundos

app.get('/api/tcg/sets', async (req, res) => {
    const cacheKey = 'sets';
    
    if (tcgCache.has(cacheKey)) {
        const cached = tcgCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return res.json(cached.data);
        }
    }
    
    try {
        const response = await fetch('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate');
        if (!response.ok) throw new Error('Error fetching sets');
        const data = await response.json();
        
        tcgCache.set(cacheKey, { timestamp: Date.now(), data });
        res.json(data);
    } catch (error) {
        console.error('TCG API Sets Error:', error);
        res.status(500).json({ error: 'Failed to fetch sets' });
    }
});

app.get('/api/tcg/cards', async (req, res) => {
    const query = req.query.q || '';
    const cacheKey = `cards_${query}`;
    
    if (tcgCache.has(cacheKey)) {
        const cached = tcgCache.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_DURATION) {
            return res.json(cached.data);
        }
    }
    
    try {
        const url = query 
            ? `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}` 
            : 'https://api.pokemontcg.io/v2/cards';
            
        const response = await fetch(url);
        if (!response.ok) throw new Error('Error fetching cards');
        const data = await response.json();
        
        tcgCache.set(cacheKey, { timestamp: Date.now(), data });
        res.json(data);
    } catch (error) {
        console.error('TCG API Cards Error:', error);
        res.status(500).json({ error: 'Failed to fetch cards' });
    }
});

app.listen(port, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${port}`);
});
