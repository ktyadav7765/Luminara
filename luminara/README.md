# Luminara Glass 🪟✨

Luminara Glass is a full-featured artisan glass e-commerce platform backed by a robust REST API built with Express.js and PostgreSQL.

## Tech Stack

| Layer      | Technology                  |
|------------|-----------------------------|
| API Server | Express.js (Node.js)        |
| Database   | PostgreSQL (via `pg` pool)  |
| Frontend   | Vanilla JS (static files)   |
| Hosting    | Vercel (serverless)         |

## Features

- **Product catalogue** — browse by category, search, filter by price, sort
- **Featured products** — highlight curated artisan pieces
- **Shopping cart & checkout** — full order flow with address, payment method
- **Automatic pricing** — shipping (free ≥ ₹5,000 else ₹299), 18% GST, coupon discounts
- **Coupons** — percentage and fixed-amount discount codes with expiry and usage limits
- **Product reviews** — customer submissions with admin approval workflow
- **Contact form** — messages stored in DB with read/unread tracking
- **Newsletter** — email subscription with duplicate-handling
- **Order tracking** — track by order ID + email with status timeline
- **Admin dashboard** — order management, review moderation, stats

## Setup

### 1. Clone & install

```bash
git clone https://github.com/ktyadav7765/Luminara.git
cd Luminara/luminara
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL
```

### 3. Create database & run schema

```bash
# Create the database in PostgreSQL
psql -U postgres -c "CREATE DATABASE luminara;"

# Apply schema
psql $DATABASE_URL -f lib/schema.sql
```

### 4. Seed sample data

```bash
npm run seed
```

### 5. Start the server

```bash
npm start
# Server runs at http://localhost:3000
```

## API Endpoints

### Products

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products (filters: `category`, `min_price`, `max_price`, `search`, `sort`, `page`, `limit`) |
| GET | `/api/products/featured` | Featured products (up to 8) |
| GET | `/api/products/:slug` | Single product with category, avg rating, review count |
| GET | `/api/products/:slug/reviews` | Approved reviews for a product |
| POST | `/api/products` | Create product (admin) |
| PATCH | `/api/products/:id` | Update product (admin) |
| DELETE | `/api/products/:id` | Delete product (admin) |

### Categories

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | List active categories with product counts |

### Orders

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders` | Place an order (full checkout with pricing calculation) |
| GET | `/api/orders` | List orders (filters: `status`, `search`) |
| GET | `/api/orders/track` | Track order by `order_id` + `email` query params |
| GET | `/api/orders/:id` | Single order with items |
| PATCH | `/api/orders/:id/status` | Update order status (admin) |
| DELETE | `/api/orders/:id` | Delete order (admin) |

### Coupons

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/coupons/validate` | Validate a coupon code |
| GET | `/api/coupons` | List all coupons (admin) |

### Reviews

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reviews` | Submit a product review |
| GET | `/api/reviews/pending` | Pending reviews awaiting approval (admin) |
| PATCH | `/api/reviews/:id` | Approve or reject a review (admin) |

### Contact

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/contact` | Submit a contact message |
| GET | `/api/contact` | List all messages (admin) |
| PATCH | `/api/contact/:id/read` | Mark a message as read (admin) |

### Newsletter

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/newsletter` | Subscribe an email address |

### Stats

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Dashboard stats (orders, products, categories, reviews, messages, subscribers) |

## Response Format

All endpoints return consistent JSON:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Descriptive error message" }
```

## Deployment (Vercel)

1. Push to GitHub
2. Import project in [vercel.com](https://vercel.com)
3. Set the `DATABASE_URL` environment variable in the Vercel dashboard
4. Deploy — the `vercel.json` configuration handles routing automatically
