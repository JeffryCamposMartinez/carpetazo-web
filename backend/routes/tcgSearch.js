import express from 'express';
import { searchTcgIndex } from '../core/tcgSearchIndex.js';
import { badRequest } from '../core/validation.js';

const router = express.Router();
router.get('/api/tcg/search-index', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const game = typeof req.query.game === 'string' ? req.query.game.trim() : '';
  const page = Number.parseInt(req.query.page, 10) || 1;
  if (query.length < 2 || query.length > 80 || game.length > 60 || page < 1 || page > 10000) return badRequest(res, 'Búsqueda inválida');
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
  res.json({ success: true, ...searchTcgIndex({ query, game, page }) });
});
export default router;
