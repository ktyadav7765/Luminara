require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const serverless = require('serverless-http');
const pool       = require('../lib/db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── POST /api/orders ────────────────────────────────────────
app.post('/api/orders', async (req, res) => {
  const { first_name, last_name, email, phone, city, items, notes } = req.body;

  if (!first_name || !email || !phone || !items?.length) {
    return res.status(400).json({
      success: false,
      error: 'Required: first_name, email, phone, and at least one item.'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `INSERT INTO orders (first_name, last_name, email, phone, city, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING id`,
      [first_name, last_name || '', email, phone, city || '', notes || '']
    );
    const orderId = orderRes.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_name, price, quantity)
         VALUES ($1,$2,$3,$4)`,
        [orderId, item.name, item.price || '', item.qty || 1]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      order_id: orderId,
      message: `Order #${orderId} received! We'll contact you at ${email} within 24 hours.`
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /api/orders ─────────────────────────────────────────
app.get('/api/orders', async (req, res) => {
  const { status, search } = req.query;
  let sql = `
    SELECT o.*,
      STRING_AGG(oi.product_name || ' ×' || oi.quantity, ' | ') AS items_summary
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
  `;
  const params = [];
  const conditions = [];

  if (status) {
    conditions.push(`o.status = $${params.length + 1}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(o.first_name ILIKE $${params.length + 1} OR o.last_name ILIKE $${params.length + 1} OR o.email ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' GROUP BY o.id ORDER BY o.created_at DESC';

  try {
    const result = await pool.query(sql, params);
    res.json({ success: true, total: result.rows.length, orders: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/orders/:id ─────────────────────────────────────
app.get('/api/orders/:id', async (req, res) => {
  try {
    const orderRes = await pool.query('SELECT * FROM orders WHERE id=$1', [req.params.id]);
    if (!orderRes.rows.length)
      return res.status(404).json({ success: false, error: 'Order not found' });

    const itemsRes = await pool.query(
      'SELECT * FROM order_items WHERE order_id=$1', [req.params.id]
    );
    res.json({ success: true, order: { ...orderRes.rows[0], items: itemsRes.rows } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PATCH /api/orders/:id/status ────────────────────────────
app.patch('/api/orders/:id/status', async (req, res) => {
  const valid = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'];
  const { status } = req.body;

  if (!valid.includes(status))
    return res.status(400).json({ success: false, error: `Status must be one of: ${valid.join(', ')}` });

  try {
    const result = await pool.query(
      `UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING id`,
      [status, req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, message: `Order #${req.params.id} updated to "${status}"` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DELETE /api/orders/:id ──────────────────────────────────
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM orders WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, message: `Order #${req.params.id} deleted.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/stats ──────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [byStatus, topProducts, recent] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`),
      pool.query(`
        SELECT product_name, SUM(quantity) as total
        FROM order_items GROUP BY product_name ORDER BY total DESC LIMIT 5
      `),
      pool.query(`
        SELECT id, first_name||' '||COALESCE(last_name,'') AS name,
               email, phone, status, created_at
        FROM orders ORDER BY created_at DESC LIMIT 10
      `)
    ]);

    res.json({
      success: true,
      stats: {
        by_status:    byStatus.rows,
        top_products: topProducts.rows,
        recent:       recent.rows
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Serve pages ─────────────────────────────────────────────
app.get('/admin', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'))
);
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
);

// Local dev
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`✦ Running → http://localhost:${PORT}`));
}

module.exports = app;
module.exports.handler = serverless(app);