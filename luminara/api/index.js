require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const serverless = require('serverless-http');
const rateLimit  = require('express-rate-limit');
const pool       = require('../lib/db');

const app = express();

const GST_RATE = 0.18;

// ── Rate limiters ────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);
app.use('/api/orders', writeLimiter);
app.use('/api/reviews', writeLimiter);
app.use('/api/contact', writeLimiter);
app.use('/api/newsletter', writeLimiter);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Helpers ─────────────────────────────────────────────────
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitize(obj) {
  if (typeof obj === 'string') return escapeHtml(obj);
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) out[k] = sanitize(obj[k]);
    return out;
  }
  return obj;
}

// ── Products ─────────────────────────────────────────────────

// GET /api/products/featured  (must be BEFORE /api/products/:slug)
app.get('/api/products/featured', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_featured = true AND p.is_active = true
       ORDER BY p.created_at DESC
       LIMIT 8`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products
app.get('/api/products', async (req, res) => {
  const {
    category, min_price, max_price, search,
    sort = 'newest', page = 1, limit = 12
  } = req.query;

  const params = [];
  const conditions = ['p.is_active = true'];

  if (category) {
    conditions.push(`c.slug = $${params.length + 1}`);
    params.push(category);
  }
  if (min_price) {
    conditions.push(`p.price >= $${params.length + 1}`);
    params.push(Number(min_price));
  }
  if (max_price) {
    conditions.push(`p.price <= $${params.length + 1}`);
    params.push(Number(max_price));
  }
  if (search) {
    conditions.push(`(p.name ILIKE $${params.length + 1} OR p.description ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }

  const sortMap = {
    price_asc:  'p.price ASC',
    price_desc: 'p.price DESC',
    newest:     'p.created_at DESC',
    name_asc:   'p.name ASC'
  };
  const orderBy = sortMap[sort] || 'p.created_at DESC';

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
  const offset   = (pageNum - 1) * limitNum;

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT p.*, c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${where}
         ORDER BY ${orderBy}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limitNum, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         ${where}`,
        params
      )
    ]);

    const total      = parseInt(countRes.rows[0].count, 10);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: { products: dataRes.rows, total, page: pageNum, totalPages }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products/:slug
app.get('/api/products/:slug', async (req, res) => {
  try {
    const productRes = await pool.query(
      `SELECT p.*, c.name AS category_name,
              ROUND(AVG(r.rating), 1) AS avg_rating,
              COUNT(r.id) FILTER (WHERE r.is_approved = true) AS review_count
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN reviews r ON r.product_id = p.id
       WHERE p.slug = $1 AND p.is_active = true
       GROUP BY p.id, c.name`,
      [req.params.slug]
    );
    if (!productRes.rows.length)
      return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: productRes.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/products
app.post('/api/products', async (req, res) => {
  const {
    name, slug, description, short_description, category_id, price,
    compare_at_price, currency, icon, stock_quantity, is_featured, tags, specifications
  } = sanitize(req.body);

  if (!name || !price)
    return res.status(400).json({ success: false, error: 'Required: name, price' });

  try {
    const result = await pool.query(
      `INSERT INTO products
         (name, slug, description, short_description, category_id, price,
          compare_at_price, currency, icon, stock_quantity, is_featured, tags, specifications)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        name, slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), description,
        short_description, category_id, price, compare_at_price,
        currency || '₹', icon, stock_quantity || 0, is_featured || false,
        JSON.stringify(tags || []), JSON.stringify(specifications || {})
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/products/:id
app.patch('/api/products/:id', async (req, res) => {
  const fields = ['name', 'description', 'short_description', 'price', 'compare_at_price',
                  'stock_quantity', 'is_featured', 'is_active', 'tags', 'specifications'];
  const updates = [];
  const params  = [];

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      params.push(typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f]);
      updates.push(`${f}=$${params.length}`);
    }
  }

  if (!updates.length)
    return res.status(400).json({ success: false, error: 'No fields to update' });

  params.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE products SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${params.length} RETURNING *`,
      params
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/products/:id
app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, message: `Product #${req.params.id} deleted.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Categories ───────────────────────────────────────────────

// GET /api/categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
       WHERE c.is_active = true
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Coupons ──────────────────────────────────────────────────

// POST /api/coupons/validate
app.post('/api/coupons/validate', async (req, res) => {
  const { code, order_amount } = req.body;
  if (!code)
    return res.status(400).json({ success: false, error: 'Coupon code is required' });

  try {
    const result = await pool.query(
      'SELECT * FROM coupons WHERE code = $1 AND is_active = true',
      [String(code).trim().toUpperCase()]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, valid: false, error: 'Invalid coupon code' });

    const coupon = result.rows[0];

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
      return res.json({ success: true, valid: false, message: 'Coupon has expired' });

    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
      return res.json({ success: true, valid: false, message: 'Coupon usage limit reached' });

    const amount = parseFloat(order_amount) || 0;
    if (amount < parseFloat(coupon.min_order_amount))
      return res.json({
        success: true,
        valid: false,
        message: `Minimum order amount is ₹${coupon.min_order_amount}`
      });

    res.json({
      success: true,
      valid: true,
      data: { type: coupon.type, value: coupon.value, code: coupon.code },
      message: coupon.type === 'percentage'
        ? `${coupon.value}% discount applied!`
        : `₹${coupon.value} discount applied!`
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/coupons
app.get('/api/coupons', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Reviews ──────────────────────────────────────────────────

// POST /api/reviews
app.post('/api/reviews', async (req, res) => {
  const { product_id, customer_name, customer_email, rating, review_text } = sanitize(req.body);

  if (!product_id || !customer_name || !customer_email || !rating)
    return res.status(400).json({
      success: false,
      error: 'Required: product_id, customer_name, customer_email, rating'
    });

  if (rating < 1 || rating > 5)
    return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });

  try {
    const result = await pool.query(
      `INSERT INTO reviews (product_id, customer_name, customer_email, rating, review_text)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [product_id, customer_name, customer_email, parseInt(rating, 10), review_text || '']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/products/:slug/reviews  (approved reviews for a product)
app.get('/api/products/:slug/reviews', async (req, res) => {
  try {
    const productRes = await pool.query(
      'SELECT id FROM products WHERE slug = $1', [req.params.slug]
    );
    if (!productRes.rows.length)
      return res.status(404).json({ success: false, error: 'Product not found' });

    const result = await pool.query(
      `SELECT id, customer_name, rating, review_text, created_at
       FROM reviews
       WHERE product_id = $1 AND is_approved = true
       ORDER BY created_at DESC`,
      [productRes.rows[0].id]
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/reviews/pending
app.get('/api/reviews/pending', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.name AS product_name
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       WHERE r.is_approved = false
       ORDER BY r.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/reviews/:id
app.patch('/api/reviews/:id', async (req, res) => {
  const { is_approved } = req.body;
  if (is_approved === undefined)
    return res.status(400).json({ success: false, error: 'is_approved is required' });

  try {
    const result = await pool.query(
      'UPDATE reviews SET is_approved=$1 WHERE id=$2 RETURNING *',
      [is_approved, req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Review not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Contact ──────────────────────────────────────────────────

// POST /api/contact
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, subject, message } = sanitize(req.body);
  if (!name || !email || !message)
    return res.status(400).json({ success: false, error: 'Required: name, email, message' });

  try {
    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, phone, subject, message)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, email, phone || '', subject || '', message]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/contact
app.get('/api/contact', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM contact_messages ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// PATCH /api/contact/:id/read
app.patch('/api/contact/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE contact_messages SET is_read=true WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Message not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Newsletter ───────────────────────────────────────────────

// POST /api/newsletter
app.post('/api/newsletter', async (req, res) => {
  const { email } = sanitize(req.body);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, error: 'Valid email is required' });

  try {
    await pool.query(
      `INSERT INTO newsletter_subscribers (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET is_active=true`,
      [email]
    );
    res.status(201).json({ success: true, message: 'Subscribed successfully!' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Orders ───────────────────────────────────────────────────

// POST /api/orders
app.post('/api/orders', async (req, res) => {
  const {
    first_name, last_name, email, phone, city, items, notes,
    address_line1, address_line2, state, pincode, country,
    payment_method, coupon_code
  } = sanitize(req.body);

  if (!first_name || !email || !phone || !items?.length) {
    return res.status(400).json({
      success: false,
      error: 'Required: first_name, email, phone, and at least one item.'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calculate subtotal from items
    let subtotal = items.reduce((sum, item) => {
      return sum + (parseFloat(item.price) || 0) * (parseInt(item.qty, 10) || 1);
    }, 0);

    // Shipping: free if subtotal >= 5000, else ₹299
    const shipping_cost = subtotal >= 5000 ? 0 : 299;

    // Validate and apply coupon
    let discount_amount = 0;
    let applied_coupon  = null;
    if (coupon_code) {
      const couponRes = await client.query(
        'SELECT * FROM coupons WHERE code=$1 AND is_active=true FOR UPDATE',
        [String(coupon_code).trim().toUpperCase()]
      );
      if (couponRes.rows.length) {
        const coupon = couponRes.rows[0];
        const valid  =
          (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) &&
          (coupon.max_uses === null || coupon.used_count < coupon.max_uses) &&
          subtotal >= parseFloat(coupon.min_order_amount);

        if (valid) {
          discount_amount = coupon.type === 'percentage'
            ? parseFloat((subtotal * coupon.value / 100).toFixed(2))
            : Math.min(parseFloat(coupon.value), subtotal);
          applied_coupon = coupon.code;
          await client.query(
            'UPDATE coupons SET used_count=used_count+1 WHERE id=$1', [coupon.id]
          );
        }
      }
    }

    // GST on (subtotal - discount + shipping)
    const taxable     = subtotal - discount_amount + shipping_cost;
    const tax_amount  = parseFloat((taxable * GST_RATE).toFixed(2));
    const total       = parseFloat((taxable + tax_amount).toFixed(2));

    const orderRes = await client.query(
      `INSERT INTO orders
         (first_name, last_name, email, phone, city, notes, status,
          address_line1, address_line2, state, pincode, country, payment_method,
          shipping_cost, tax_amount, discount_amount, subtotal, total, coupon_code)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        first_name, last_name || '', email, phone, city || '', notes || '',
        address_line1 || '', address_line2 || '', state || '', pincode || '',
        country || 'India', payment_method || 'cod',
        shipping_cost, tax_amount, discount_amount, subtotal, total,
        applied_coupon || null
      ]
    );
    const orderId = orderRes.rows[0].id;

    for (const item of items) {
      // Decrease stock if product_id provided
      if (item.product_id) {
        await client.query(
          'UPDATE products SET stock_quantity=GREATEST(0, stock_quantity-$1) WHERE id=$2',
          [parseInt(item.qty, 10) || 1, item.product_id]
        );
      }
      await client.query(
        `INSERT INTO order_items (order_id, product_name, price, quantity)
         VALUES ($1,$2,$3,$4)`,
        [orderId, item.name, parseFloat(item.price) || 0, parseInt(item.qty, 10) || 1]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: { order_id: orderId, total, subtotal, tax_amount, shipping_cost, discount_amount },
      message: `Order #${orderId} received! We'll contact you at ${email} within 24 hours.`
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// GET /api/orders/track
app.get('/api/orders/track', async (req, res) => {
  const { order_id, email } = req.query;
  if (!order_id || !email)
    return res.status(400).json({ success: false, error: 'order_id and email are required' });

  try {
    const orderRes = await pool.query(
      'SELECT * FROM orders WHERE id=$1 AND email=$2', [order_id, email]
    );
    if (!orderRes.rows.length)
      return res.status(404).json({ success: false, error: 'Order not found' });

    const itemsRes = await pool.query(
      'SELECT * FROM order_items WHERE order_id=$1', [order_id]
    );

    const statusTimeline = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered'];
    const currentIdx     = statusTimeline.indexOf(orderRes.rows[0].status);
    const timeline       = statusTimeline.map((s, i) => ({
      status:    s,
      completed: i <= currentIdx
    }));

    res.json({
      success: true,
      data: { order: { ...orderRes.rows[0], items: itemsRes.rows }, timeline }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/orders
app.get('/api/orders', async (req, res) => {
  const { status, search } = req.query;
  let sql = `
    SELECT o.*,
      STRING_AGG(oi.product_name || ' ×' || oi.quantity, ' | ') AS items_summary
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
  `;
  const params     = [];
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

// GET /api/orders/:id
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

// PATCH /api/orders/:id/status
app.patch('/api/orders/:id/status', async (req, res) => {
  const valid  = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'];
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

// DELETE /api/orders/:id
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

// ── Stats ────────────────────────────────────────────────────

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  try {
    const [
      byStatus, topProducts, recent,
      productCount, categoryCount, pendingReviews, unreadMessages, subscriberCount
    ] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`),
      pool.query(`
        SELECT product_name, SUM(quantity) as total
        FROM order_items GROUP BY product_name ORDER BY total DESC LIMIT 5
      `),
      pool.query(`
        SELECT id, first_name||' '||COALESCE(last_name,'') AS name,
               email, phone, status, created_at
        FROM orders ORDER BY created_at DESC LIMIT 10
      `),
      pool.query(`SELECT COUNT(*) FROM products WHERE is_active=true`),
      pool.query(`SELECT COUNT(*) FROM categories WHERE is_active=true`),
      pool.query(`SELECT COUNT(*) FROM reviews WHERE is_approved=false`),
      pool.query(`SELECT COUNT(*) FROM contact_messages WHERE is_read=false`),
      pool.query(`SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active=true`)
    ]);

    res.json({
      success: true,
      stats: {
        by_status:           byStatus.rows,
        top_products:        topProducts.rows,
        recent:              recent.rows,
        total_products:      parseInt(productCount.rows[0].count, 10),
        total_categories:    parseInt(categoryCount.rows[0].count, 10),
        pending_reviews:     parseInt(pendingReviews.rows[0].count, 10),
        unread_messages:     parseInt(unreadMessages.rows[0].count, 10),
        newsletter_subscribers: parseInt(subscriberCount.rows[0].count, 10)
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