const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100),
        slug        VARCHAR(100) UNIQUE,
        description TEXT,
        icon        VARCHAR(10),
        sort_order  INTEGER DEFAULT 0,
        is_active   BOOLEAN DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id                SERIAL PRIMARY KEY,
        name              VARCHAR(200),
        slug              VARCHAR(200) UNIQUE,
        description       TEXT,
        short_description VARCHAR(500),
        category_id       INTEGER REFERENCES categories(id),
        price             NUMERIC(10,2) NOT NULL,
        compare_at_price  NUMERIC(10,2),
        currency          VARCHAR(10) DEFAULT '₹',
        icon              VARCHAR(10),
        stock_quantity    INTEGER DEFAULT 0,
        is_featured       BOOLEAN DEFAULT false,
        is_active         BOOLEAN DEFAULT true,
        tags              JSONB DEFAULT '[]',
        specifications    JSONB DEFAULT '{}',
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id                SERIAL PRIMARY KEY,
        first_name        TEXT NOT NULL,
        last_name         TEXT,
        email             TEXT NOT NULL,
        phone             TEXT NOT NULL,
        city              TEXT,
        notes             TEXT,
        status            TEXT DEFAULT 'pending',
        address_line1     VARCHAR(500),
        address_line2     VARCHAR(500),
        state             VARCHAR(100),
        pincode           VARCHAR(20),
        country           VARCHAR(100) DEFAULT 'India',
        payment_method    VARCHAR(50) DEFAULT 'cod',
        shipping_cost     NUMERIC(10,2) DEFAULT 0,
        tax_amount        NUMERIC(10,2) DEFAULT 0,
        discount_amount   NUMERIC(10,2) DEFAULT 0,
        subtotal          NUMERIC(10,2) DEFAULT 0,
        total             NUMERIC(10,2) DEFAULT 0,
        coupon_code       VARCHAR(50),
        tracking_number   VARCHAR(100),
        estimated_delivery TIMESTAMPTZ,
        created_at        TIMESTAMPTZ DEFAULT NOW(),
        updated_at        TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id           SERIAL PRIMARY KEY,
        order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_name TEXT NOT NULL,
        price        NUMERIC(10,2),
        quantity     INTEGER DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        id               SERIAL PRIMARY KEY,
        code             VARCHAR(50) UNIQUE,
        type             VARCHAR(20) CHECK (type IN ('percentage', 'fixed')),
        value            NUMERIC(10,2),
        min_order_amount NUMERIC(10,2) DEFAULT 0,
        max_uses         INTEGER DEFAULT NULL,
        used_count       INTEGER DEFAULT 0,
        is_active        BOOLEAN DEFAULT true,
        expires_at       TIMESTAMPTZ,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id             SERIAL PRIMARY KEY,
        product_id     INTEGER REFERENCES products(id) ON DELETE CASCADE,
        customer_name  VARCHAR(200),
        customer_email VARCHAR(200),
        rating         INTEGER CHECK (rating >= 1 AND rating <= 5),
        review_text    TEXT,
        is_approved    BOOLEAN DEFAULT false,
        created_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(200),
        email      VARCHAR(200),
        phone      VARCHAR(20),
        subject    VARCHAR(300),
        message    TEXT,
        is_read    BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id            SERIAL PRIMARY KEY,
        email         VARCHAR(200) UNIQUE,
        is_active     BOOLEAN DEFAULT true,
        subscribed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_slug        ON products(slug)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_email         ON orders(email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_coupons_code         ON coupons(code)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_product_id   ON reviews(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_is_approved  ON reviews(is_approved)`);

    console.log('✦ Database tables ready');
  } catch (e) {
    console.error('DB init error:', e.message);
  } finally {
    client.release();
  }
}

initDB();

module.exports = pool;