const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id         SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name  TEXT,
        email      TEXT NOT NULL,
        phone      TEXT NOT NULL,
        city       TEXT,
        notes      TEXT,
        status     TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id           SERIAL PRIMARY KEY,
        order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        price        TEXT,
        quantity     INTEGER DEFAULT 1
      )
    `);

    console.log('✦ Database tables ready');
  } catch (e) {
    console.error('DB init error:', e.message);
  } finally {
    client.release();
  }
}

initDB();

module.exports = pool;