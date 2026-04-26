const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/alerts — all alerts with pole info
router.get('/', async (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT a.*, p.pole_name, p.location_name, p.latitude, p.longitude
    FROM alerts a
    LEFT JOIN poles p ON a.pole_id = p.pole_id
  `;
  const params = [];
  if (status) {
    query += ' WHERE a.status = ?';
    params.push(status);
  }
  query += ' ORDER BY a.created_at DESC';
  const alerts = await db.prepare(query).all(...params);
  res.json(alerts);
});

// GET /api/alerts/:id
router.get('/:id', async (req, res) => {
  const alert = await db.prepare(`
    SELECT a.*, p.pole_name, p.location_name
    FROM alerts a
    LEFT JOIN poles p ON a.pole_id = p.pole_id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

// POST /api/alerts — create new alert (simulates SOS press)
router.post('/', async (req, res) => {
  const { pole_id, alert_type, priority, ai_summary } = req.body;
  if (!pole_id) return res.status(400).json({ error: 'pole_id is required' });

  const pole = await db.prepare('SELECT * FROM poles WHERE pole_id = ?').get(pole_id);
  if (!pole) return res.status(404).json({ error: 'Pole not found' });

  let summaryStr = ai_summary;
  let finalPriority = priority || 'HIGH';

  if (!summaryStr) {
    const aiData = await require('../ai').generateAlertSummary(pole_id, pole.location_name, new Date().toLocaleTimeString());
    summaryStr = JSON.stringify(aiData);
    if (aiData && aiData.Severity) {
        finalPriority = aiData.Severity.toUpperCase();
    }
  }

  const info = await db.prepare(`
    INSERT INTO alerts (pole_id, alert_type, priority, status, ai_summary)
    VALUES (?, ?, ?, 'active', ?)
  `).run(
    pole_id,
    alert_type || 'SOS',
    finalPriority,
    summaryStr
  );

  const alert = await db.prepare(`
    SELECT a.*, p.pole_name, p.location_name, p.latitude, p.longitude
    FROM alerts a LEFT JOIN poles p ON a.pole_id = p.pole_id
    WHERE a.id = ?
  `).get(info.lastInsertRowid);

  // Emit to all connected clients
  const io = req.app.get('io');
  io.emit('new_alert', alert);

  res.status(201).json(alert);
});

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', async (req, res) => {
  const alert = await db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  if (alert.status === 'resolved') return res.status(400).json({ error: 'Already resolved' });

  await db.prepare(
    "UPDATE alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(req.params.id);

  const updated = await db.prepare(`
    SELECT a.*, p.pole_name, p.location_name
    FROM alerts a LEFT JOIN poles p ON a.pole_id = p.pole_id
    WHERE a.id = ?
  `).get(req.params.id);

  const io = req.app.get('io');
  io.emit('alert_resolved', updated);

  res.json(updated);
});

module.exports = router;
