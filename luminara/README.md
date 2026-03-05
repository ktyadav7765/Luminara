# Luminara Glass — Artisan Glass E-commerce Platform

A full-featured e-commerce backend for Luminara Glass, an online store specialising in handcrafted artisan glass products. Built with Express.js and PostgreSQL, deployable to Vercel.

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| API Server | Express.js (Node.js)              |
| Database   | PostgreSQL (via `pg` driver)      |
| Frontend   | Vanilla JS / HTML / CSS           |
| Hosting    | Vercel (serverless functions)     |

---

## Features

- Product catalogue with categories, filtering, search, and pagination
- Featured products showcase
- Coupon / discount code system (percentage and fixed amounts)
- Customer reviews with admin moderation
- Full checkout flow with GST (18%) and dynamic shipping calculation
- Order tracking by order ID + email
- Contact form with admin inbox
- Newsletter subscription
- Admin dashboard stats endpoint

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/ktyadav7765/Luminara.git
cd Luminara/luminara
npm install
```

### 2. Set environment variables

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection string
```

### 3. Create the database and run schema

```bash
psql $DATABASE_URL -f lib/schema.sql
```

### 4. Seed the database

```bash
npm run seed
```

### 5. Start the development server

```bash
npm run dev
# API available at http://localhost:3000
```

---

## API Endpoints

### Products

| Method | Path                         | Description                                    |
|--------|------------------------------|------------------------------------------------|
| GET    | `/api/products`              | List products (filter, sort, paginate)         |
| GET    | `/api/products/featured`     | List featured products (max 8)                 |
| GET    | `/api/products/:slug`        | Single product with rating & review count      |
| POST   | `/api/products`              | Create product (admin)                         |
| PATCH  | `/api/products/:id`          | Update product (admin)                         |
| DELETE | `/api/products/:id`          | Delete product (admin)                         |

**GET `/api/products` query params:** `category` (slug), `min_price`, `max_price`, `search`, `sort` (`price_asc` | `price_desc` | `newest` | `name_asc`), `page`, `limit`

### Categories

| Method | Path              | Description                              |
|--------|-------------------|------------------------------------------|
| GET    | `/api/categories` | List active categories with product counts |

### Coupons

| Method | Path                    | Description                    |
|--------|-------------------------|--------------------------------|
| POST   | `/api/coupons/validate` | Validate a coupon code         |
| GET    | `/api/coupons`          | List all coupons (admin)       |

### Reviews

| Method | Path                          | Description                         |
|--------|-------------------------------|-------------------------------------|
| POST   | `/api/reviews`                | Submit a review                     |
| GET    | `/api/products/:slug/reviews` | Approved reviews for a product      |
| GET    | `/api/reviews/pending`        | Pending reviews (admin)             |
| PATCH  | `/api/reviews/:id`            | Approve / reject review (admin)     |

### Contact

| Method | Path                      | Description              |
|--------|---------------------------|--------------------------|
| POST   | `/api/contact`            | Submit a contact message |
| GET    | `/api/contact`            | List messages (admin)    |
| PATCH  | `/api/contact/:id/read`   | Mark message as read     |

### Newsletter

| Method | Path              | Description       |
|--------|-------------------|-------------------|
| POST   | `/api/newsletter` | Subscribe an email |

### Orders

| Method | Path                     | Description                               |
|--------|--------------------------|-------------------------------------------|
| POST   | `/api/orders`            | Place an order (full checkout)            |
| GET    | `/api/orders`            | List orders (admin, supports filter)      |
| GET    | `/api/orders/track`      | Track order (`?order_id=&email=`)         |
| GET    | `/api/orders/:id`        | Single order with items                   |
| PATCH  | `/api/orders/:id/status` | Update order status (admin)               |
| DELETE | `/api/orders/:id`        | Delete order (admin)                      |

### Stats

| Method | Path         | Description                |
|--------|--------------|----------------------------|
| GET    | `/api/stats` | Dashboard statistics       |

---

## Response Format

All endpoints return JSON in one of these shapes:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Error message" }
```

---

## Deployment (Vercel)

1. Push the repository to GitHub.
2. Import the project into [Vercel](https://vercel.com).
3. Set the `DATABASE_URL` environment variable in the Vercel project settings.
4. Vercel will use `vercel.json` to route all requests through `api/index.js`.

---

## Seeded Data

After running `npm run seed` you will have:

- **12 categories**: Bangles, Mirrors, Lighting, Chandeliers, Wall Art, Vases, Lamps, Wind Chimes, Figurines, Jewelry, Panels, Home Decor
- **14 products** with realistic INR prices, descriptions, specifications, and stock levels
- **3 coupons**:
  - `WELCOME10` — 10% off, no minimum
  - `GLASS500` — ₹500 off, minimum order ₹5,000
  - `ARTISAN15` — 15% off, minimum order ₹3,000, expires in 30 days
