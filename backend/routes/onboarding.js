// Guía de primeros pasos del vendedor.
import express from 'express';
import { authenticateToken, currentUserId } from '../core/auth.js';
import { getOnboarding, markShared } from '../core/onboarding.js';

const router = express.Router();

router.get('/api/onboarding', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    const state = userId ? await getOnboarding(userId) : null;
    if (!state) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, ...state });
  } catch (error) {
    console.error('Error loading onboarding:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// La persona copió o compartió el enlace de su carpeta desde la guía
router.post('/api/onboarding/shared', authenticateToken, async (req, res) => {
  try {
    const userId = await currentUserId(req);
    if (!userId) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await markShared(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving onboarding share:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
