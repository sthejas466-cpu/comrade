const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// JWT secret is set in app.locals by server.js (loaded from .env)

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const operator = await db.prepare('SELECT * FROM operators WHERE email = ?').get(email);
    if (!operator) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, operator.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const secret = req.app.locals.jwtSecret;
    const token = jwt.sign(
      { id: operator.id, email: operator.email, role: operator.role, name: operator.name },
      secret,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email,
        role: operator.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout (client-side only, but provides endpoint)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

module.exports = router;
