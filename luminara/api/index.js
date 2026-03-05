require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const serverless = require('serverless-http');
const rateLimit  = require('express-rate-limit');
const pool       = require('../lib/db');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Rate limiting ────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many orders submitted, please try again later.' }
});
app.use('/api/', apiLimiter);
app.use('/api/orders', orderLimiter);

// ── Helpers ──────────────────────────────────────────────────
const GST_RATE               = 0.18;
const FREE_SHIPPING_THRESHOLD = 5000;
const STANDARD_SHIPPING_COST  = 299;
const THIRTY_DAYS_MS          = 30 * 24 * 60 * 60 * 1000;

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
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? escapeHtml(v) : v;
  }
  return out;
}

// ── POST /api/orders ────────────────────────────────────────
app.post('/api/orders', async (req, res) => {
  const s = sanitize(req.body);
  const {
    first_name, last_name, email, phone, city, items, notes,
    address_line1, address_line2, state, pincode, country,
    payment_method, coupon_code
  } = s;

  if (!first_name || !email || !phone || !items?.length) {
    return res.status(400).json({
      success: false,
      error: 'Required: first_name, email, phone, and at least one item.'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calculate subtotal from DB prices (prevents client-side price manipulation)
    let subtotal = 0;
    const enrichedItems = [];
    for (const item of items) {
      let unitPrice = 0;
      if (item.slug) {
        const priceRes = await client.query(
          'SELECT price, name FROM products WHERE slug=$1 AND is_active=true',
          [item.slug]
        );
        if (priceRes.rows.length) {
          unitPrice = parseFloat(priceRes.rows[0].price);
          enrichedItems.push({ ...item, name: item.name || priceRes.rows[0].name, price: unitPrice });
        } else {
          enrichedItems.push({ ...item, price: parseFloat(item.price) || 0 });
          unitPrice = parseFloat(item.price) || 0;
        }
      } else {
        unitPrice = parseFloat(item.price) || 0;
        enrichedItems.push({ ...item, price: unitPrice });
      }
      subtotal += unitPrice * (parseInt(item.qty) || 1);
    }

    // Shipping: free if subtotal >= FREE_SHIPPING_THRESHOLD, else STANDARD_SHIPPING_COST
    const shipping_cost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_COST;

    // Coupon validation
    let discount_amount = 0;
    let validatedCoupon = null;
    if (coupon_code) {
      const couponRes = await client.query(
        `SELECT * FROM coupons WHERE code=$1 AND is_active=true`,
        [coupon_code.toUpperCase()]
      );
      if (couponRes.rows.length) {
        const coupon = couponRes.rows[0];
        const now = new Date();
        if ((!coupon.expires_at || new Date(coupon.expires_at) > now) &&
            (coupon.max_uses === null || coupon.used_count < coupon.max_uses) &&
            subtotal >= parseFloat(coupon.min_order_amount)) {
          validatedCoupon = coupon;
          if (coupon.type === 'percentage') {
            discount_amount = subtotal * (parseFloat(coupon.value) / 100);
          } else {
            discount_amount = parseFloat(coupon.value);
          }
        }
      }
    }

    // Tax: GST_RATE on (subtotal - discount + shipping)
    const taxable = subtotal - discount_amount + shipping_cost;
    const tax_amount = parseFloat((taxable * GST_RATE).toFixed(2));
    const total = parseFloat((taxable + tax_amount).toFixed(2));

    const orderRes = await client.query(
      `INSERT INTO orders
         (first_name, last_name, email, phone, city, notes, status,
          address_line1, address_line2, state, pincode, country,
          payment_method, shipping_cost, tax_amount, discount_amount,
          subtotal, total, coupon_code)
       VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        first_name, last_name || '', email, phone, city || '', notes || '',
        address_line1 || '', address_line2 || '', state || '', pincode || '',
        country || 'India', payment_method || 'cod',
        shipping_cost, tax_amount, discount_amount,
        subtotal.toFixed(2), total, validatedCoupon ? validatedCoupon.code : null
      ]
    );
    const orderId = orderRes.rows[0].id;

    for (const item of enrichedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_name, price, quantity)
         VALUES ($1,$2,$3,$4)`,
        [orderId, item.name, item.price, parseInt(item.qty) || 1]
      );
      // Decrease product stock if product slug provided
      if (item.slug) {
        await client.query(
          `UPDATE products SET stock_quantity = GREATEST(stock_quantity - $1, 0), updated_at=NOW()
           WHERE slug=$2`,
          [parseInt(item.qty) || 1, item.slug]
        );
      }
    }

    // Update coupon used_count
    if (validatedCoupon) {
      await client.query(
        `UPDATE coupons SET used_count = used_count + 1 WHERE id=$1`,
        [validatedCoupon.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: {
        order_id: orderId,
        subtotal,
        shipping_cost,
        discount_amount,
        tax_amount,
        total,
        message: `Order #${orderId} received! We'll contact you at ${email} within 24 hours.`
      }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// ── GET /api/orders/track ────────────────────────────────────
app.get('/api/orders/track', async (req, res) => {
  const { order_id, email } = req.query;
  if (!order_id || !email) {
    return res.status(400).json({ success: false, error: 'order_id and email are required.' });
  }
  try {
    const orderRes = await pool.query(
      'SELECT * FROM orders WHERE id=$1 AND email=$2',
      [order_id, email]
    );
    if (!orderRes.rows.length)
      return res.status(404).json({ success: false, error: 'Order not found.' });

    const itemsRes = await pool.query(
      'SELECT * FROM order_items WHERE order_id=$1', [order_id]
    );
    const order = orderRes.rows[0];
    const statusTimeline = ['pending', 'confirmed', 'in_production', 'shipped', 'delivered'];
    const currentIndex = statusTimeline.indexOf(order.status);
    res.json({
      success: true,
      data: {
        ...order,
        items: itemsRes.rows,
        timeline: statusTimeline.map((s, i) => ({ status: s, completed: i <= currentIndex }))
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
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
    const [byStatus, topProducts, recent, extraStats] = await Promise.all([
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
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM products WHERE is_active=true)       AS total_products,
          (SELECT COUNT(*) FROM categories WHERE is_active=true)     AS total_categories,
          (SELECT COUNT(*) FROM reviews WHERE is_approved=false)     AS pending_reviews,
          (SELECT COUNT(*) FROM contact_messages WHERE is_read=false) AS unread_messages,
          (SELECT COUNT(*) FROM newsletter_subscribers WHERE is_active=true) AS newsletter_subscribers
      `)
    ]);

    res.json({
      success: true,
      stats: {
        by_status:              byStatus.rows,
        top_products:           topProducts.rows,
        recent:                 recent.rows,
        total_products:         parseInt(extraStats.rows[0].total_products) || 0,
        total_categories:       parseInt(extraStats.rows[0].total_categories) || 0,
        pending_reviews:        parseInt(extraStats.rows[0].pending_reviews) || 0,
        unread_messages:        parseInt(extraStats.rows[0].unread_messages) || 0,
        newsletter_subscribers: parseInt(extraStats.rows[0].newsletter_subscribers) || 0
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/categories ──────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.id) FILTER (WHERE p.is_active=true) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/products/featured ───────────────────────────────
app.get('/api/products/featured', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_featured = true AND p.is_active = true
      ORDER BY p.created_at DESC
      LIMIT 8
    `);
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/products ────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  const { category, min_price, max_price, search, sort, page = 1, limit = 12 } = req.query;
  const params = [];
  const conditions = ['p.is_active = true'];

  if (category) {
    conditions.push(`c.slug = $${params.length + 1}`);
    params.push(category);
  }
  if (min_price) {
    conditions.push(`p.price >= $${params.length + 1}`);
    params.push(parseFloat(min_price));
  }
  if (max_price) {
    conditions.push(`p.price <= $${params.length + 1}`);
    params.push(parseFloat(max_price));
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

  const pageNum  = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset   = (pageNum - 1) * limitNum;

  const whereClause = ' WHERE ' + conditions.join(' AND ');
  const baseQuery = `
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${whereClause}
  `;

  try {
    const limitParam  = params.length + 1;
    const offsetParam = params.length + 2;
    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug ${baseQuery}
         ORDER BY ${orderBy} LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...params, limitNum, offset]
      ),
      pool.query(`SELECT COUNT(*) ${baseQuery}`, params)
    ]);
    const total      = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(total / limitNum);
    res.json({
      success: true,
      data: { products: dataRes.rows, total, page: pageNum, totalPages }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/products/:slug/reviews ──────────────────────────
app.get('/api/products/:slug/reviews', async (req, res) => {
  try {
    const prodRes = await pool.query('SELECT id FROM products WHERE slug=$1', [req.params.slug]);
    if (!prodRes.rows.length)
      return res.status(404).json({ success: false, error: 'Product not found.' });
    const result = await pool.query(
      `SELECT id, customer_name, rating, review_text, created_at
       FROM reviews
       WHERE product_id=$1 AND is_approved=true
       ORDER BY created_at DESC`,
      [prodRes.rows[0].id]
    );
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/products/:slug ──────────────────────────────────
app.get('/api/products/:slug', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug,
             ROUND(AVG(r.rating), 1) AS avg_rating,
             COUNT(r.id) FILTER (WHERE r.is_approved=true) AS review_count
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN reviews r ON r.product_id = p.id
      WHERE p.slug=$1 AND p.is_active=true
      GROUP BY p.id, c.name, c.slug
    `, [req.params.slug]);
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Product not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/products ───────────────────────────────────────
app.post('/api/products', async (req, res) => {
  const s = sanitize(req.body);
  const {
    name, slug, description, short_description, category_id,
    price, compare_at_price, icon, stock_quantity,
    is_featured, tags, specifications
  } = s;
  if (!name || !slug || price == null) {
    return res.status(400).json({ success: false, error: 'name, slug, and price are required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO products
         (name, slug, description, short_description, category_id, price, compare_at_price, icon,
          stock_quantity, is_featured, tags, specifications)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        name, slug, description || null, short_description || null, category_id || null,
        price, compare_at_price || null, icon || null,
        stock_quantity || 0, is_featured || false,
        JSON.stringify(tags || []), JSON.stringify(specifications || {})
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ success: false, error: 'Slug already exists.' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PATCH /api/products/:id ──────────────────────────────────
app.patch('/api/products/:id', async (req, res) => {
  const s = sanitize(req.body);
  const fields = [];
  const values = [];
  const allowed = [
    'name','slug','description','short_description','category_id','price',
    'compare_at_price','icon','stock_quantity','is_featured','is_active','tags','specifications'
  ];
  for (const key of allowed) {
    if (s[key] !== undefined) {
      fields.push(`${key}=$${fields.length + 1}`);
      values.push(['tags','specifications'].includes(key) ? JSON.stringify(s[key]) : s[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ success: false, error: 'No fields to update.' });
  fields.push(`updated_at=NOW()`);
  values.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE products SET ${fields.join(',')} WHERE id=$${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Product not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── DELETE /api/products/:id ─────────────────────────────────
app.delete('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Product not found.' });
    res.json({ success: true, message: `Product #${req.params.id} deleted.` });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/coupons/validate ───────────────────────────────
app.post('/api/coupons/validate', async (req, res) => {
  const { code, order_amount } = req.body;
  if (!code) return res.status(400).json({ success: false, error: 'Coupon code is required.' });
  try {
    const result = await pool.query(
      `SELECT * FROM coupons WHERE code=$1 AND is_active=true`,
      [code.toUpperCase()]
    );
    if (!result.rows.length)
      return res.json({ success: true, valid: false, message: 'Invalid coupon code.' });

    const coupon = result.rows[0];
    const now = new Date();
    if (coupon.expires_at && new Date(coupon.expires_at) <= now)
      return res.json({ success: true, valid: false, message: 'Coupon has expired.' });
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses)
      return res.json({ success: true, valid: false, message: 'Coupon usage limit reached.' });
    if (order_amount && parseFloat(order_amount) < parseFloat(coupon.min_order_amount))
      return res.json({
        success: true, valid: false,
        message: `Minimum order amount is ₹${coupon.min_order_amount}.`
      });

    res.json({
      success: true, valid: true,
      data: { type: coupon.type, value: coupon.value, message: 'Coupon applied successfully.' }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/coupons ─────────────────────────────────────────
app.get('/api/coupons', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/reviews ────────────────────────────────────────
app.post('/api/reviews', async (req, res) => {
  const s = sanitize(req.body);
  const { product_id, customer_name, customer_email, rating, review_text } = s;
  if (!product_id || !customer_name || !rating) {
    return res.status(400).json({ success: false, error: 'product_id, customer_name, and rating are required.' });
  }
  const ratingNum = parseInt(rating);
  if (ratingNum < 1 || ratingNum > 5)
    return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5.' });
  try {
    const result = await pool.query(
      `INSERT INTO reviews (product_id, customer_name, customer_email, rating, review_text)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [product_id, customer_name, customer_email || null, ratingNum, review_text || null]
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'Review submitted for approval.' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/reviews/pending ──────────────────────────────────
app.get('/api/reviews/pending', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, p.name AS product_name, p.slug AS product_slug
      FROM reviews r
      LEFT JOIN products p ON p.id = r.product_id
      WHERE r.is_approved = false
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PATCH /api/reviews/:id ───────────────────────────────────
app.patch('/api/reviews/:id', async (req, res) => {
  const { is_approved } = req.body;
  if (typeof is_approved !== 'boolean')
    return res.status(400).json({ success: false, error: 'is_approved (boolean) is required.' });
  try {
    const result = await pool.query(
      'UPDATE reviews SET is_approved=$1 WHERE id=$2 RETURNING *',
      [is_approved, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Review not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/contact ────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const s = sanitize(req.body);
  const { name, email, phone, subject, message } = s;
  if (!name || !email || !message)
    return res.status(400).json({ success: false, error: 'name, email, and message are required.' });
  try {
    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, phone, subject, message)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, email, phone || null, subject || null, message]
    );
    res.status(201).json({ success: true, data: result.rows[0], message: 'Message received. We\'ll get back to you soon!' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/contact ──────────────────────────────────────────
app.get('/api/contact', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contact_messages ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── PATCH /api/contact/:id/read ───────────────────────────────
app.patch('/api/contact/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE contact_messages SET is_read=true WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Message not found.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── POST /api/newsletter ──────────────────────────────────────
app.post('/api/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  try {
    await pool.query(
      `INSERT INTO newsletter_subscribers (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET is_active=true, subscribed_at=NOW()`,
      [escapeHtml(email)]
    );
    res.status(201).json({ success: true, message: 'Successfully subscribed to the newsletter!' });
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