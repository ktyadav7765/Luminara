require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('./db');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const categories = [
  { name: 'Bangles',    slug: 'bangles',    description: 'Handcrafted glass bangles for every occasion.',          icon: '💫', sort_order: 1 },
  { name: 'Mirrors',    slug: 'mirrors',    description: 'Decorative glass mirrors for walls and spaces.',          icon: '🪞', sort_order: 2 },
  { name: 'Lighting',   slug: 'lighting',   description: 'Artisan glass pendant lights and lamps.',                 icon: '💡', sort_order: 3 },
  { name: 'Chandeliers',slug: 'chandeliers',description: 'Stunning crystal chandeliers for grand interiors.',       icon: '✨', sort_order: 4 },
  { name: 'Wall Art',   slug: 'wall-art',   description: 'Unique glass wall art and stained glass panels.',         icon: '🎨', sort_order: 5 },
  { name: 'Vases',      slug: 'vases',      description: 'Elegant glass vases and decorative bowls.',               icon: '🏺', sort_order: 6 },
  { name: 'Lamps',      slug: 'lamps',      description: 'Handmade mosaic and blown glass lamps.',                  icon: '🪔', sort_order: 7 },
  { name: 'Wind Chimes',slug: 'wind-chimes',description: 'Melodious glass wind chimes for home and garden.',        icon: '🎐', sort_order: 8 },
  { name: 'Figurines',  slug: 'figurines',  description: 'Delicate glass figurines and sculptures.',                icon: '🦢', sort_order: 9 },
  { name: 'Jewelry',    slug: 'jewelry',    description: 'Fine glass jewelry and accessories.',                     icon: '💎', sort_order: 10 },
  { name: 'Panels',     slug: 'panels',     description: 'Stained glass panels and custom glass artwork.',          icon: '🖼️', sort_order: 11 },
  { name: 'Home Decor', slug: 'home-decor', description: 'Assorted glass home décor items for every room.',        icon: '🏡', sort_order: 12 },
];

const products = [
  {
    name: 'Glass Bangles Set',
    slug: 'glass-bangles-set',
    description: 'A stunning set of hand-blown glass bangles crafted by skilled artisans using traditional techniques. Each bangle is uniquely shaped with vibrant swirls of color that catch the light beautifully. Perfect as a gift or a statement piece for any outfit.',
    short_description: 'Hand-blown artisan glass bangles in vibrant colours.',
    category_slug: 'bangles',
    price: 1299,
    compare_at_price: 1799,
    icon: '💫',
    stock_quantity: 75,
    is_featured: true,
    tags: ['bangles', 'jewellery', 'handmade', 'gift'],
    specifications: { material: 'Borosilicate glass', dimensions: 'Diameter 6–7 cm', weight: '120 g (set of 6)', care: 'Wipe with a soft dry cloth; avoid impact' }
  },
  {
    name: 'Decorative Mirrors',
    slug: 'decorative-mirrors',
    description: 'Exquisitely framed decorative glass mirrors that add depth and elegance to any room. The mosaic glass border is handcrafted from recycled coloured glass pieces set in resin. Hang individually or cluster several for a gallery-wall effect.',
    short_description: 'Handcrafted mosaic-framed decorative wall mirrors.',
    category_slug: 'mirrors',
    price: 4999,
    compare_at_price: 6499,
    icon: '🪞',
    stock_quantity: 30,
    is_featured: true,
    tags: ['mirrors', 'wall decor', 'mosaic', 'home decor'],
    specifications: { material: 'Float glass, mosaic border', dimensions: '40 cm × 40 cm', weight: '1.8 kg', care: 'Clean glass with a lint-free cloth and glass cleaner' }
  },
  {
    name: 'Glass Pendant Lights',
    slug: 'glass-pendant-lights',
    description: 'Hand-blown glass pendant lights that create a warm, diffused glow in any space. Each shade is individually crafted, making every piece truly one-of-a-kind. Ideal for kitchen islands, dining tables, or entryways.',
    short_description: 'Hand-blown glass pendant lights with warm diffused glow.',
    category_slug: 'lighting',
    price: 3499,
    compare_at_price: null,
    icon: '💡',
    stock_quantity: 40,
    is_featured: false,
    tags: ['lighting', 'pendant', 'handmade', 'interior'],
    specifications: { material: 'Borosilicate glass, brass fitting', dimensions: 'Shade diameter 18 cm, height 22 cm', weight: '600 g', care: 'Dust regularly; wipe with damp cloth when cool' }
  },
  {
    name: 'Crystal Chandelier',
    slug: 'crystal-chandelier',
    description: 'A breathtaking crystal glass chandelier that transforms any room into a grand ballroom. Hand-assembled with individually cut crystal drops that refract light into thousands of rainbows. Suitable for living rooms, dining halls, and hotel lobbies.',
    short_description: 'Hand-assembled crystal glass chandelier with rainbow light effects.',
    category_slug: 'chandeliers',
    price: 24999,
    compare_at_price: 32000,
    icon: '✨',
    stock_quantity: 10,
    is_featured: true,
    tags: ['chandelier', 'crystal', 'luxury', 'lighting'],
    specifications: { material: 'K9 crystal glass, chrome frame', dimensions: 'Diameter 60 cm, height 55 cm', weight: '7.5 kg', care: 'Professional cleaning recommended; dust with a soft brush' }
  },
  {
    name: 'Glass Wall Art',
    slug: 'glass-wall-art',
    description: 'Bold and contemporary fused glass wall art panels that serve as striking focal points in modern interiors. Each piece is kiln-formed from layered coloured glass, resulting in deep, complex colour fields. Includes mounting hardware.',
    short_description: 'Kiln-formed fused glass wall art panels for modern interiors.',
    category_slug: 'wall-art',
    price: 6999,
    compare_at_price: null,
    icon: '🎨',
    stock_quantity: 20,
    is_featured: true,
    tags: ['wall art', 'fused glass', 'contemporary', 'interior'],
    specifications: { material: 'Fused art glass', dimensions: '50 cm × 35 cm', weight: '2.2 kg', care: 'Dust with a soft dry cloth; avoid abrasive cleaners' }
  },
  {
    name: 'Vases & Bowls',
    slug: 'vases-and-bowls',
    description: 'A curated collection of hand-blown glass vases and decorative bowls in a range of shapes and jewel-toned colours. Each piece is mouth-blown by master glassblowers, preserving the organic beauty of the medium. Display alone or fill with flowers or fruit.',
    short_description: 'Mouth-blown glass vases and bowls in jewel-tone colours.',
    category_slug: 'vases',
    price: 2499,
    compare_at_price: 3200,
    icon: '🏺',
    stock_quantity: 60,
    is_featured: false,
    tags: ['vases', 'bowls', 'blown glass', 'table decor'],
    specifications: { material: 'Borosilicate blown glass', dimensions: 'Height 25–30 cm (varies)', weight: '450 g (avg)', care: 'Hand-wash only with mild soap; avoid sudden temperature changes' }
  },
  {
    name: 'Mosaic Glass Lamps',
    slug: 'mosaic-glass-lamps',
    description: 'Inspired by the intricate lanterns of the Ottoman era, these mosaic glass lamps cast mesmerising patterns of coloured light across walls and ceilings. Each lamp is handcrafted with hundreds of individually cut glass tiles set in a bronze-finish metal frame.',
    short_description: 'Ottoman-inspired mosaic glass lamps with mesmerising light patterns.',
    category_slug: 'lamps',
    price: 3999,
    compare_at_price: 4999,
    icon: '🪔',
    stock_quantity: 35,
    is_featured: true,
    tags: ['lamps', 'mosaic', 'table lamp', 'handmade'],
    specifications: { material: 'Coloured glass tiles, bronze-finish metal', dimensions: 'Height 35 cm, diameter 20 cm', weight: '1.4 kg', care: 'Dust tile surfaces gently; use bulbs ≤40 W' }
  },
  {
    name: 'Glass Wind Chimes',
    slug: 'glass-wind-chimes',
    description: 'Delicate hand-painted glass wind chimes that tinkle melodiously in the breeze and bring positive energy to your home or garden. The translucent glass pieces are individually kiln-fired with mineral pigments for lasting colour. Weather-resistant for outdoor use.',
    short_description: 'Hand-painted glass wind chimes — melodious and weather-resistant.',
    category_slug: 'wind-chimes',
    price: 1799,
    compare_at_price: null,
    icon: '🎐',
    stock_quantity: 55,
    is_featured: false,
    tags: ['wind chimes', 'garden', 'outdoor', 'handmade'],
    specifications: { material: 'Kiln-fired painted glass, stainless steel wire', dimensions: 'Overall length 45 cm', weight: '180 g', care: 'Wipe clean with damp cloth; suitable for covered outdoor areas' }
  },
  {
    name: 'Stained Glass Panels',
    slug: 'stained-glass-panels',
    description: 'Museum-quality stained glass panels handcrafted using the traditional copper-foil technique. Rich, cathedral-grade coloured glass is hand-cut and soldered to create luminous artwork that glows when backlit by natural or artificial light. Made to order.',
    short_description: 'Traditional copper-foil stained glass panels with cathedral-grade glass.',
    category_slug: 'panels',
    price: 8999,
    compare_at_price: 11000,
    icon: '🖼️',
    stock_quantity: 15,
    is_featured: true,
    tags: ['stained glass', 'panels', 'traditional', 'artwork'],
    specifications: { material: 'Cathedral glass, copper foil, lead-free solder', dimensions: '45 cm × 60 cm', weight: '3.2 kg', care: 'Clean with glass cleaner and soft cloth; handle with cotton gloves' }
  },
  {
    name: 'Glass Figurines',
    slug: 'glass-figurines',
    description: 'Enchanting hand-sculpted glass figurines that capture the grace and movement of animals, birds, and mythical creatures. Each figurine is crafted at the flame by skilled lampwork artists using borosilicate glass rods. A perfect collector\'s item.',
    short_description: 'Hand-sculpted lampwork glass figurines by skilled artisans.',
    category_slug: 'figurines',
    price: 2999,
    compare_at_price: null,
    icon: '🦢',
    stock_quantity: 45,
    is_featured: false,
    tags: ['figurines', 'lampwork', 'sculpture', 'collectible'],
    specifications: { material: 'Borosilicate lampwork glass', dimensions: 'Height 8–12 cm (varies)', weight: '80 g (avg)', care: 'Handle with care; dust with a soft brush; keep away from edges' }
  },
  {
    name: 'Glass Jewelry Box',
    slug: 'glass-jewelry-box',
    description: 'An elegant jewelry box with hand-painted glass panels and a velvet-lined interior, making it the perfect home for your treasured accessories. The lid features intricate etched floral motifs. A luxurious gift for any occasion.',
    short_description: 'Etched glass jewelry box with velvet-lined interior.',
    category_slug: 'jewelry',
    price: 1999,
    compare_at_price: 2499,
    icon: '💎',
    stock_quantity: 50,
    is_featured: false,
    tags: ['jewelry box', 'gift', 'etched glass', 'storage'],
    specifications: { material: 'Etched glass, velvet lining, brass hinges', dimensions: '18 cm × 12 cm × 8 cm', weight: '520 g', care: 'Wipe exterior with soft cloth; do not immerse in water' }
  },
  {
    name: 'Glass Table Tops',
    slug: 'glass-table-tops',
    description: 'Custom-cut tempered glass table tops that bring a sleek, modern aesthetic to any furniture piece. Available in clear, frosted, or tinted finishes with polished bevelled edges. Toughened for daily use — safe for families and offices alike.',
    short_description: 'Tempered glass table tops with polished bevelled edges.',
    category_slug: 'home-decor',
    price: 12999,
    compare_at_price: 15999,
    icon: '🔮',
    stock_quantity: 20,
    is_featured: true,
    tags: ['table top', 'tempered glass', 'furniture', 'interior'],
    specifications: { material: 'Tempered float glass', dimensions: 'Custom sizes up to 120 cm × 60 cm', weight: 'Approx 8 kg/m²', care: 'Clean with glass cleaner; avoid sharp impacts on edges' }
  },
  {
    name: 'Glass Photo Frames',
    slug: 'glass-photo-frames',
    description: 'Beautifully crafted mosaic glass photo frames that transform your cherished memories into works of art. The hand-set glass tile border comes in a range of colour themes to complement any interior. Available in multiple photo sizes.',
    short_description: 'Mosaic glass photo frames in multiple colour themes.',
    category_slug: 'home-decor',
    price: 1499,
    compare_at_price: null,
    icon: '📸',
    stock_quantity: 80,
    is_featured: false,
    tags: ['photo frame', 'mosaic', 'gift', 'home decor'],
    specifications: { material: 'Mosaic glass tiles, MDF backing', dimensions: 'Fits 10 cm × 15 cm photo', weight: '280 g', care: 'Wipe with a dry cloth; avoid moisture near MDF backing' }
  },
  {
    name: 'Blown Glass Ornaments',
    slug: 'blown-glass-ornaments',
    description: 'Iridescent hand-blown glass ornaments that make exquisite tree decorations or year-round display pieces. Each ornament is mouth-blown and hand-painted with gold and silver accents. Packaged in a gift-ready box — ideal for festive gifting.',
    short_description: 'Mouth-blown iridescent glass ornaments with gold and silver accents.',
    category_slug: 'home-decor',
    price: 999,
    compare_at_price: 1299,
    icon: '🎄',
    stock_quantity: 100,
    is_featured: false,
    tags: ['ornaments', 'blown glass', 'festive', 'gift'],
    specifications: { material: 'Blown glass, gold/silver paint', dimensions: 'Diameter 6–8 cm', weight: '40 g (each)', care: 'Handle gently; store in original box; avoid moisture' }
  }
];

const coupons = [
  {
    code: 'WELCOME10',
    type: 'percentage',
    value: 10,
    min_order_amount: 0,
    max_uses: null,
    expires_at: null
  },
  {
    code: 'GLASS500',
    type: 'fixed',
    value: 500,
    min_order_amount: 5000,
    max_uses: 200,
    expires_at: null
  },
  {
    code: 'ARTISAN15',
    type: 'percentage',
    value: 15,
    min_order_amount: 3000,
    max_uses: 100,
    expires_at: new Date(Date.now() + THIRTY_DAYS_MS).toISOString()
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Categories ──────────────────────────────────────────────
    console.log('Seeding categories…');
    const categoryIds = {};
    for (const cat of categories) {
      const res = await client.query(
        `INSERT INTO categories (name, slug, description, icon, sort_order)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, icon=EXCLUDED.icon
         RETURNING id, slug`,
        [cat.name, cat.slug, cat.description, cat.icon, cat.sort_order]
      );
      categoryIds[res.rows[0].slug] = res.rows[0].id;
    }
    console.log(`  ✓ ${categories.length} categories seeded`);

    // ── Products ────────────────────────────────────────────────
    console.log('Seeding products…');
    let productCount = 0;
    for (const p of products) {
      const catId = categoryIds[p.category_slug];
      await client.query(
        `INSERT INTO products
           (name, slug, description, short_description, category_id, price, compare_at_price, currency, icon,
            stock_quantity, is_featured, tags, specifications)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'₹',$8,$9,$10,$11,$12)
         ON CONFLICT (slug) DO UPDATE
           SET name=EXCLUDED.name, description=EXCLUDED.description, short_description=EXCLUDED.short_description,
               price=EXCLUDED.price, compare_at_price=EXCLUDED.compare_at_price, icon=EXCLUDED.icon,
               stock_quantity=EXCLUDED.stock_quantity, is_featured=EXCLUDED.is_featured,
               tags=EXCLUDED.tags, specifications=EXCLUDED.specifications, updated_at=NOW()`,
        [
          p.name, p.slug, p.description, p.short_description, catId,
          p.price, p.compare_at_price || null, p.icon,
          p.stock_quantity, p.is_featured,
          JSON.stringify(p.tags), JSON.stringify(p.specifications)
        ]
      );
      productCount++;
    }
    console.log(`  ✓ ${productCount} products seeded`);

    // ── Coupons ─────────────────────────────────────────────────
    console.log('Seeding coupons…');
    for (const c of coupons) {
      await client.query(
        `INSERT INTO coupons (code, type, value, min_order_amount, max_uses, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (code) DO UPDATE
           SET type=EXCLUDED.type, value=EXCLUDED.value,
               min_order_amount=EXCLUDED.min_order_amount, max_uses=EXCLUDED.max_uses,
               expires_at=EXCLUDED.expires_at`,
        [c.code, c.type, c.value, c.min_order_amount, c.max_uses || null, c.expires_at || null]
      );
    }
    console.log(`  ✓ ${coupons.length} coupons seeded`);

    await client.query('COMMIT');
    console.log('\n✦ Seed complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
