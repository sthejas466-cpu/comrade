const bcrypt = require('bcryptjs');

let dbCompat;

// Use Postgres only if DATABASE_URL is explicitly set
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Converts 'SELECT * FROM table WHERE id = ?' to '... WHERE id = $1'
  function convertSql(sql) {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
  }

  function prepare(sql) {
    const pgSql = convertSql(sql);
    return {
      get: async (...params) => {
        const res = await pool.query(pgSql, params);
        return res.rows[0] || null;
      },
      all: async (...params) => {
        const res = await pool.query(pgSql, params);
        return res.rows;
      },
      run: async (...params) => {
        let finalSql = pgSql;
        if (finalSql.trim().toUpperCase().startsWith('INSERT') && !finalSql.toUpperCase().includes('RETURNING')) {
            finalSql = finalSql + ' RETURNING id';
        }
        const runRes = await pool.query(finalSql, params);
        return {
          changes: runRes.rowCount,
          lastInsertRowid: runRes.rows[0]?.id || null
        };
      },
    };
  }

  dbCompat = {
    prepare,
    exec: async (sql) => {
      const statements = sql.split(';').filter(s => s.trim().length > 0);
      for (const stmt of statements) {
        await pool.query(stmt);
      }
    },
    transaction: (fn) => async (...args) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await fn(...args);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };
} else {
  // Use SQLite (graceful fallback or explicitly requested for deployment)
  const Database = require('better-sqlite3');
  const dbPath = process.env.SQLITE_DB_PATH || './comrade.db';
  const db = new Database(dbPath);

  dbCompat = {
    prepare: (sql) => {
      // Postgres schema uses SERIAL, SQLite expects AUTOINCREMENT or just INTEGER PRIMARY KEY
      // We will adjust the schema logic below, but prepare runs as usual.
      const stmt = db.prepare(sql);
      return {
        get: async (...params) => stmt.get(...params),
        all: async (...params) => stmt.all(...params),
        run: async (...params) => stmt.run(...params),
      };
    },
    exec: async (sql) => {
      // Convert Postgres SERIAL back to standard SQLite for local dev
      const sqliteSql = sql.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT');
      return db.exec(sqliteSql);
    },
    transaction: (fn) => async (...args) => {
      const tx = db.transaction(fn);
      return tx(...args);
    },
  };
}

// ─── Schema ───────────────────────────────────────────────────────────────────
async function initDb() {
  await dbCompat.exec(`
    CREATE TABLE IF NOT EXISTS operators (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'operator',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS poles (
      id SERIAL PRIMARY KEY,
      pole_id VARCHAR(100) UNIQUE NOT NULL,
      pole_name VARCHAR(255) NOT NULL,
      location_name VARCHAR(255) NOT NULL,
      latitude REAL NOT NULL DEFAULT 0,
      longitude REAL NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'online',
      battery_level INTEGER NOT NULL DEFAULT 100,
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      pole_id VARCHAR(100) NOT NULL,
      alert_type VARCHAR(100) NOT NULL DEFAULT 'SOS',
      priority VARCHAR(50) NOT NULL DEFAULT 'HIGH',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      ai_summary TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS commands (
      id SERIAL PRIMARY KEY,
      pole_id VARCHAR(100) NOT NULL,
      command_type VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'sent',
      operator_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
async function seed() {
  await initDb();
  
  const row = await dbCompat.prepare('SELECT COUNT(*) as cnt FROM operators').get();
  if (row && parseInt(row.cnt, 10) > 0) return;

  console.log('🌱 Seeding database…');

  const insertOp = dbCompat.prepare(
    'INSERT INTO operators (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  );
  await insertOp.run('Admin User', 'admin@comrade.gov', bcrypt.hashSync('admin123', 10), 'admin');
  await insertOp.run('Field Operator', 'operator@comrade.gov', bcrypt.hashSync('operator123', 10), 'operator');

  const insertPole = dbCompat.prepare(`
    INSERT INTO poles (pole_id, pole_name, location_name, latitude, longitude, status, battery_level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const poles = [
    ['POLE-001', 'Alpha-1', 'Central Bus Stand, Gate A', 12.9716, 77.5946, 'online',  87],
    ['POLE-002', 'Alpha-2', 'Central Bus Stand, Gate B', 12.9718, 77.5948, 'online',  64],
    ['POLE-003', 'Beta-1',  'City Market, North Entry',  12.9741, 77.6101, 'online',  95],
    ['POLE-004', 'Beta-2',  'City Market, South Entry',  12.9738, 77.6099, 'offline', 12],
    ['POLE-005', 'Gamma-1', 'Railway Station, Platform 1', 12.9815, 77.5990, 'online', 78],
  ];
  for (const p of poles) {
    await insertPole.run(...p);
  }

  const insertAlert = dbCompat.prepare(`
    INSERT INTO alerts (pole_id, alert_type, priority, status, ai_summary, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const ago = (m) => new Date(Date.now() - m * 60000).toISOString().replace('T', ' ').substring(0, 19);

  // 3 active
  await insertAlert.run('POLE-001','SOS','CRITICAL','active','SOS button pressed. Individual appears distressed near Gate A. Possible medical emergency.',ago(4),null);
  await insertAlert.run('POLE-003','SOS','HIGH',   'active','Emergency signal triggered at City Market. Crowd detected. Possible altercation.',ago(11),null);
  await insertAlert.run('POLE-005','SOS','HIGH',   'active','SOS activated at Railway Station Platform 1. Unattended luggage reported nearby.',ago(18),null);
  // 5 resolved
  await insertAlert.run('POLE-002','SOS','HIGH',   'resolved','False alarm — passenger accidentally pressed button. Cleared.',ago(120),ago(105));
  await insertAlert.run('POLE-004','SOS','CRITICAL','resolved','Medical emergency — ambulance dispatched. Patient stabilised.',ago(240),ago(215));
  await insertAlert.run('POLE-001','SOS','MEDIUM', 'resolved','Minor vendor dispute. Police notified. Resolved peacefully.',ago(360),ago(340));
  await insertAlert.run('POLE-003','SOS','HIGH',   'resolved','Suspected theft. Security responded. Suspect detained.',ago(480),ago(460));
  await insertAlert.run('POLE-005','SOS','MEDIUM', 'resolved','Child reported lost. Reunited with guardians in 12 minutes.',ago(600),ago(588));

  console.log('✅ Seed complete.');
}

// Call seed but don't block exports
seed().catch(err => console.error('Seeding failed:', err));

module.exports = dbCompat;
