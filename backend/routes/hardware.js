const express = require('express');
const router = express.Router();
const db = require('../db');

// API key is loaded from .env via server.js → app.locals.poleApiKey
function poleAuth(req, res, next) {
  const key = req.headers['x-pole-key'];
  const expected = req.app.locals.poleApiKey;
  if (!key || key !== expected) {
    return res.status(401).json({ success: false, error: 'Invalid or missing pole API key' });
  }
  next();
}

// ─── POST /api/pole-alert ─────────────────────────────────────────────────────
// Called by physical pole hardware when SOS button is pressed.
// Body: { pole_id, alert_type? }
router.post('/pole-alert', poleAuth, async (req, res) => {
  const { pole_id, alert_type } = req.body;

  if (!pole_id) {
    return res.status(400).json({ success: false, error: 'pole_id is required' });
  }

  // Validate pole exists
  const pole = await db.prepare('SELECT * FROM poles WHERE pole_id = ?').get(pole_id);
  if (!pole) {
    return res.status(404).json({ success: false, error: 'Pole not found' });
  }

  // Update pole last_seen timestamp
  await db.prepare('UPDATE poles SET last_seen = CURRENT_TIMESTAMP WHERE pole_id = ?').run(pole_id);

  // Create the alert
  const resolvedType = alert_type || 'SOS';
  const aiData = await require('../ai').generateAlertSummary(pole_id, pole.location_name, new Date().toLocaleTimeString());
  const finalPriority = aiData && aiData.Severity ? aiData.Severity.toUpperCase() : 'HIGH';
  const summaryStr = JSON.stringify(aiData);

  const info = await db.prepare(`
    INSERT INTO alerts (pole_id, alert_type, priority, status, ai_summary)
    VALUES (?, ?, ?, 'active', ?)
  `).run(pole_id, resolvedType, finalPriority, summaryStr);

  const alert = await db.prepare(`
    SELECT a.*, p.pole_name, p.location_name, p.latitude, p.longitude
    FROM alerts a LEFT JOIN poles p ON a.pole_id = p.pole_id
    WHERE a.id = ?
  `).get(info.lastInsertRowid);

  // Push real-time event to all dashboard clients
  const io = req.app.get('io');
  io.emit('new_alert', alert);

  console.log(`🚨 [HW] Alert from ${pole_id} (${resolvedType}) — alert #${info.lastInsertRowid}`);

  res.status(201).json({ success: true, alert_id: info.lastInsertRowid });
});

// ─── GET /api/pole-command?pole_id=BUS001 ────────────────────────────────────
// Polled by physical pole hardware to check for pending commands.
// Returns the latest pending command for the pole, or "none".
router.get('/pole-command', poleAuth, async (req, res) => {
  const { pole_id } = req.query;

  if (!pole_id) {
    return res.status(400).json({ success: false, error: 'pole_id query param is required' });
  }

  // Look for the latest unsent/pending command for this pole
  const command = await db.prepare(`
    SELECT * FROM commands
    WHERE pole_id = ? AND status = 'sent'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(pole_id);

  if (!command) {
    return res.json({ success: true, command: 'none' });
  }

  // Determine normalized command name
  const raw = command.command_type.toLowerCase();
  let normalized = 'none';
  if (raw.includes('siren_on') || raw === 'siren on') normalized = 'siren_on';
  else if (raw.includes('siren_off') || raw === 'siren off') normalized = 'siren_off';
  else if (raw.includes('broadcast')) normalized = 'broadcast';

  // Mark command as delivered to the pole
  await db.prepare("UPDATE commands SET status = 'delivered' WHERE id = ?").run(command.id);

  // Notify dashboard that command was picked up
  const io = req.app.get('io');
  io.emit('command_executed', { ...command, status: 'delivered' });

  console.log(`📡 [HW] Command "${normalized}" delivered to ${pole_id}`);

  res.json({
    success: true,
    command: normalized,
    command_id: command.id,
    raw: command.command_type,
  });
});

module.exports = router;
