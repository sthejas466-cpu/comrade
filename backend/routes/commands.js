const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/commands
router.get('/', async (req, res) => {
  const commands = await db.prepare(`
    SELECT c.*, p.pole_name, p.location_name, o.name as operator_name
    FROM commands c
    LEFT JOIN poles p ON c.pole_id = p.pole_id
    LEFT JOIN operators o ON c.operator_id = o.id
    ORDER BY c.created_at DESC
    LIMIT 100
  `).all();
  res.json(commands);
});

// POST /api/commands — send command to pole
router.post('/', async (req, res) => {
  const { pole_id, command_type } = req.body;
  if (!pole_id || !command_type) {
    return res.status(400).json({ error: 'pole_id and command_type are required' });
  }

  const pole = await db.prepare('SELECT * FROM poles WHERE pole_id = ?').get(pole_id);
  if (!pole) return res.status(404).json({ error: 'Pole not found' });

  const info = await db.prepare(`
    INSERT INTO commands (pole_id, command_type, status, operator_id)
    VALUES (?, ?, 'sent', ?)
  `).run(pole_id, command_type, req.user?.id || null);

  const command = await db.prepare(`
    SELECT c.*, p.pole_name, p.location_name, o.name as operator_name
    FROM commands c
    LEFT JOIN poles p ON c.pole_id = p.pole_id
    LEFT JOIN operators o ON c.operator_id = o.id
    WHERE c.id = ?
  `).get(info.lastInsertRowid);

  // Emit socket event
  const io = req.app.get('io');
  io.emit('command_sent', command);

  // Simulate command execution after 1.5s
  setTimeout(async () => {
    await db.prepare("UPDATE commands SET status = 'executed' WHERE id = ?").run(info.lastInsertRowid);
    io.emit('command_executed', { ...command, status: 'executed' });
  }, 1500);

  res.status(201).json(command);
});

// POST /api/commands/broadcast — broadcast message
router.post('/broadcast', async (req, res) => {
  const { message, pole_ids } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  let targets = pole_ids;
  if (!targets || targets.length === 0) {
    const poles = await db.prepare("SELECT pole_id FROM poles WHERE status = 'online'").all();
    targets = poles.map(p => p.pole_id);
  }

  const insertCmd = db.prepare(`
    INSERT INTO commands (pole_id, command_type, status, operator_id) VALUES (?, ?, 'sent', ?)
  `);
  const insertMany = db.transaction(async (ids) => {
    for (const pid of ids) {
      await insertCmd.run(pid, `BROADCAST: ${message}`, req.user?.id || null);
    }
  });
  await insertMany(targets);

  const io = req.app.get('io');
  io.emit('broadcast_sent', { message, pole_count: targets.length, time: new Date().toISOString() });

  res.json({ message: 'Broadcast sent', pole_count: targets.length });
});

module.exports = router;
