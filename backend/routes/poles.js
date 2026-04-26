const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/poles — all poles
router.get('/', async (req, res) => {
  const poles = await db.prepare('SELECT * FROM poles ORDER BY created_at ASC').all();
  res.json(poles);
});

// GET /api/poles/:pole_id — single pole
router.get('/:pole_id', async (req, res) => {
  const pole = await db.prepare('SELECT * FROM poles WHERE pole_id = ?').get(req.params.pole_id);
  if (!pole) return res.status(404).json({ error: 'Pole not found' });
  res.json(pole);
});

// PATCH /api/poles/:pole_id — update pole
router.patch('/:pole_id', async (req, res) => {
  const { status, battery_level } = req.body;
  const pole = await db.prepare('SELECT * FROM poles WHERE pole_id = ?').get(req.params.pole_id);
  if (!pole) return res.status(404).json({ error: 'Pole not found' });

  const updates = [];
  const params = [];
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (battery_level !== undefined) { updates.push('battery_level = ?'); params.push(battery_level); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  updates.push('last_seen = CURRENT_TIMESTAMP');
  params.push(req.params.pole_id);

  await db.prepare(`UPDATE poles SET ${updates.join(', ')} WHERE pole_id = ?`).run(...params);

  const updated = await db.prepare('SELECT * FROM poles WHERE pole_id = ?').get(req.params.pole_id);

  // Emit socket event
  const io = req.app.get('io');
  io.emit('pole_updated', updated);

  res.json(updated);
});

// POST /api/poles — add new pole
router.post('/', async (req, res) => {
  const { pole_id, pole_name, location_name, latitude, longitude, status, battery_level } = req.body;
  if (!pole_id || !pole_name || !location_name) {
    return res.status(400).json({ error: 'pole_id, pole_name, location_name are required' });
  }
  try {
    await db.prepare(`
      INSERT INTO poles (pole_id, pole_name, location_name, latitude, longitude, status, battery_level)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(pole_id, pole_name, location_name, latitude || 0, longitude || 0, status || 'online', battery_level || 100);

    const pole = await db.prepare('SELECT * FROM poles WHERE pole_id = ?').get(pole_id);
    const io = req.app.get('io');
    io.emit('pole_added', pole);
    res.status(201).json(pole);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
