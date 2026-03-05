require('dotenv').config();
const pool = require('./db');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('✦ Starting seed...');

    // ── Categories ─────────────────────────────────────────────
    const categoryData = [
      { name: 'Bangles',     slug: 'bangles',     description: 'Handcrafted glass bangles in vibrant colours.',           icon: '💫', sort_order: 1 },
      { name: 'Mirrors',     slug: 'mirrors',     description: 'Decorative glass mirrors for every space.',               icon: '🪞', sort_order: 2 },
      { name: 'Lighting',    slug: 'lighting',    description: 'Glass pendant lights and lamp shades.',                   icon: '💡', sort_order: 3 },
      { name: 'Chandeliers', slug: 'chandeliers', description: 'Crystal and glass chandeliers for grand interiors.',      icon: '✨', sort_order: 4 },
      { name: 'Wall Art',    slug: 'wall-art',    description: 'Stunning glass wall art and decorative panels.',          icon: '🎨', sort_order: 5 },
      { name: 'Vases',       slug: 'vases',       description: 'Hand-blown glass vases and decorative bowls.',            icon: '🏺', sort_order: 6 },
      { name: 'Lamps',       slug: 'lamps',       description: 'Mosaic and stained glass lamps for ambient lighting.',    icon: '🪔', sort_order: 7 },
      { name: 'Wind Chimes', slug: 'wind-chimes', description: 'Melodic glass wind chimes for gardens and balconies.',   icon: '🎐', sort_order: 8 },
      { name: 'Figurines',   slug: 'figurines',   description: 'Delicate hand-crafted glass figurines and sculptures.',  icon: '🦢', sort_order: 9 },
      { name: 'Jewelry',     slug: 'jewelry',     description: 'Artisan glass jewelry including pendants and earrings.', icon: '💎', sort_order: 10 },
      { name: 'Panels',      slug: 'panels',      description: 'Stained and leaded glass panels for windows and doors.', icon: '🖼️', sort_order: 11 },
      { name: 'Home Decor',  slug: 'home-decor',  description: 'Unique glass home décor pieces for every room.',         icon: '🏠', sort_order: 12 },
    ];

    const categoryIds = {};
    for (const cat of categoryData) {
      const res = await client.query(
        `INSERT INTO categories (name, slug, description, icon, sort_order)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, icon=EXCLUDED.icon
         RETURNING id, slug`,
        [cat.name, cat.slug, cat.description, cat.icon, cat.sort_order]
      );
      categoryIds[cat.slug] = res.rows[0].id;
    }
    console.log(`  ✓ ${categoryData.length} categories seeded`);

    // ── Products ───────────────────────────────────────────────
    const productData = [
      {
        name: 'Glass Bangles Set',
        slug: 'glass-bangles-set',
        description: 'A stunning set of 12 hand-crafted glass bangles featuring vibrant, swirling colours. Each bangle is individually shaped by skilled artisans using traditional glass-blowing techniques. Perfect as a gift or a colourful addition to your jewellery collection.',
        short_description: 'Set of 12 hand-crafted vibrant glass bangles.',
        category_slug: 'bangles',
        price: 1299.00,
        compare_at_price: 1799.00,
        icon: '💫',
        stock_quantity: 80,
        is_featured: true,
        tags: ['bangles', 'jewelry', 'handcrafted', 'gift'],
        specifications: { material: 'Borosilicate glass', dimensions: 'Diameter 6–8 cm', weight: '120 g (set)', care: 'Wipe with soft dry cloth' }
      },
      {
        name: 'Decorative Mirrors',
        slug: 'decorative-mirrors',
        description: 'Elegant hand-cut glass mosaic mirrors that add sparkle and depth to any room. The intricate mosaic border is assembled piece by piece, reflecting light beautifully throughout the day. Available in round and rectangular frames.',
        short_description: 'Hand-cut glass mosaic mirrors for home décor.',
        category_slug: 'mirrors',
        price: 4999.00,
        compare_at_price: 6499.00,
        icon: '🪞',
        stock_quantity: 30,
        is_featured: true,
        tags: ['mirrors', 'mosaic', 'wall-decor', 'handcrafted'],
        specifications: { material: 'Glass mosaic, wooden frame', dimensions: '45 × 45 cm', weight: '2.5 kg', care: 'Clean glass with mild glass cleaner' }
      },
      {
        name: 'Glass Pendant Lights',
        slug: 'glass-pendant-lights',
        description: 'Hand-blown glass pendant lights that cast warm, colourful patterns across your ceiling and walls. Each shade is uniquely shaped and coloured by master glass blowers. Ideal for dining rooms, kitchens, and boutique spaces.',
        short_description: 'Hand-blown glass pendant lights for warm ambiance.',
        category_slug: 'lighting',
        price: 3499.00,
        compare_at_price: null,
        icon: '💡',
        stock_quantity: 45,
        is_featured: false,
        tags: ['lighting', 'pendant', 'hand-blown', 'interior'],
        specifications: { material: 'Borosilicate glass', dimensions: 'Shade diameter 18 cm, cord 120 cm', weight: '0.8 kg', care: 'Dust with soft brush; handle with care' }
      },
      {
        name: 'Crystal Chandelier',
        slug: 'crystal-chandelier',
        description: 'A breathtaking crystal glass chandelier featuring 48 hand-cut crystal drops that scatter prismatic light around the room. The polished brass frame ensures timeless elegance. An heirloom centrepiece for your home.',
        short_description: 'Breathtaking 48-drop crystal glass chandelier.',
        category_slug: 'chandeliers',
        price: 24999.00,
        compare_at_price: 32000.00,
        icon: '✨',
        stock_quantity: 10,
        is_featured: true,
        tags: ['chandelier', 'crystal', 'luxury', 'ceiling-light'],
        specifications: { material: 'Lead crystal glass, brass frame', dimensions: 'Diameter 60 cm, height 70 cm', weight: '8 kg', care: 'Dust with soft dry cloth; professional cleaning recommended' }
      },
      {
        name: 'Glass Wall Art',
        slug: 'glass-wall-art',
        description: 'Striking fused-glass wall art panels created by layering multiple sheets of coloured glass and kiln-firing them into a single seamless piece. Each panel is a one-of-a-kind artwork. Adds a vibrant focal point to living rooms and offices.',
        short_description: 'Unique kiln-fired fused-glass wall art panels.',
        category_slug: 'wall-art',
        price: 6999.00,
        compare_at_price: null,
        icon: '🎨',
        stock_quantity: 20,
        is_featured: true,
        tags: ['wall-art', 'fused-glass', 'abstract', 'home-decor'],
        specifications: { material: 'Fused art glass', dimensions: '50 × 70 cm', weight: '3 kg', care: 'Do not use abrasive cleaners' }
      },
      {
        name: 'Vases & Bowls',
        slug: 'vases-and-bowls',
        description: 'A curated collection of hand-blown glass vases and decorative bowls in rich jewel tones. Each piece is crafted using centuries-old Venetian glassblowing techniques adapted by Indian artisans. Perfect as table centrepieces or shelf displays.',
        short_description: 'Hand-blown jewel-tone glass vases and bowls.',
        category_slug: 'vases',
        price: 2499.00,
        compare_at_price: 3199.00,
        icon: '🏺',
        stock_quantity: 60,
        is_featured: false,
        tags: ['vases', 'bowls', 'hand-blown', 'tabletop'],
        specifications: { material: 'Hand-blown glass', dimensions: 'Height 25–30 cm', weight: '0.6 kg', care: 'Hand wash only; avoid sudden temperature changes' }
      },
      {
        name: 'Mosaic Glass Lamps',
        slug: 'mosaic-glass-lamps',
        description: 'Enchanting mosaic table lamps assembled from hundreds of individually cut coloured glass tiles. When lit, they project a kaleidoscope of warm colours onto surrounding surfaces. A perfect nightstand or reading corner accent.',
        short_description: 'Colourful mosaic glass table lamps for ambient light.',
        category_slug: 'lamps',
        price: 3999.00,
        compare_at_price: null,
        icon: '🪔',
        stock_quantity: 35,
        is_featured: true,
        tags: ['lamps', 'mosaic', 'table-lamp', 'ambient'],
        specifications: { material: 'Mosaic glass, brass base', dimensions: 'Height 38 cm, shade diameter 22 cm', weight: '1.5 kg', care: 'Wipe with damp cloth; do not submerge' }
      },
      {
        name: 'Glass Wind Chimes',
        slug: 'glass-wind-chimes',
        description: 'Delicate hand-shaped glass wind chimes that produce clear, melodious tones in the breeze. The chimes are tipped with tiny painted glass beads for colour and weight. Ideal for gardens, balconies, or breezy indoor spaces.',
        short_description: 'Melodious hand-shaped glass wind chimes.',
        category_slug: 'wind-chimes',
        price: 1799.00,
        compare_at_price: 2299.00,
        icon: '🎐',
        stock_quantity: 70,
        is_featured: false,
        tags: ['wind-chimes', 'garden', 'outdoor', 'handcrafted'],
        specifications: { material: 'Hand-shaped glass, nylon cord', dimensions: 'Length 45 cm, 8 chimes', weight: '0.3 kg', care: 'Bring indoors during heavy storms' }
      },
      {
        name: 'Stained Glass Panels',
        slug: 'stained-glass-panels',
        description: 'Traditional leaded stained glass panels inspired by heritage cathedral windows. Each panel is hand-assembled using the copper foil technique and features intricate botanical and geometric motifs. Can be hung in windows or displayed as framed art.',
        short_description: 'Traditional copper-foil leaded stained glass panels.',
        category_slug: 'panels',
        price: 8999.00,
        compare_at_price: 11500.00,
        icon: '🖼️',
        stock_quantity: 15,
        is_featured: true,
        tags: ['stained-glass', 'panels', 'heritage', 'window'],
        specifications: { material: 'Coloured glass, lead/copper foil', dimensions: '40 × 60 cm', weight: '2 kg', care: 'Clean gently with soft damp cloth' }
      },
      {
        name: 'Glass Figurines',
        slug: 'glass-figurines',
        description: 'Exquisite hand-sculpted glass figurines depicting animals, birds, and mythological figures. Each piece is individually formed using lampworking — a precise glass-melting technique — and features delicate painted details. A collector\'s delight.',
        short_description: 'Hand-sculpted lampworked glass figurines.',
        category_slug: 'figurines',
        price: 2999.00,
        compare_at_price: null,
        icon: '🦢',
        stock_quantity: 50,
        is_featured: false,
        tags: ['figurines', 'sculpture', 'lampwork', 'collectible'],
        specifications: { material: 'Borosilicate glass', dimensions: 'Height 10–15 cm', weight: '0.2 kg', care: 'Handle with care; dust with soft brush' }
      },
      {
        name: 'Glass Jewelry Box',
        slug: 'glass-jewelry-box',
        description: 'An elegant jewelry box with a hand-painted glass lid and mirrored interior. The ornate floral motifs on the lid are painted using vitreous glass paints and kiln-fired for permanence. Keeps your treasures safe in style.',
        short_description: 'Elegant hand-painted glass lid jewelry box.',
        category_slug: 'jewelry',
        price: 1999.00,
        compare_at_price: 2599.00,
        icon: '💎',
        stock_quantity: 40,
        is_featured: false,
        tags: ['jewelry-box', 'storage', 'painted-glass', 'gift'],
        specifications: { material: 'Glass lid, velvet-lined wooden box', dimensions: '18 × 12 × 8 cm', weight: '0.5 kg', care: 'Wipe glass lid with soft cloth; avoid moisture on wood' }
      },
      {
        name: 'Glass Table Tops',
        slug: 'glass-table-tops',
        description: 'Custom tempered glass table tops with hand-painted underside designs — a technique called reverse glass painting. The thick toughened glass ensures safety and durability while the intricate artwork beneath glows with depth and colour.',
        short_description: 'Tempered glass table tops with reverse painted art.',
        category_slug: 'home-decor',
        price: 12999.00,
        compare_at_price: 16000.00,
        icon: '🔮',
        stock_quantity: 12,
        is_featured: true,
        tags: ['table-top', 'tempered-glass', 'furniture', 'custom'],
        specifications: { material: '10 mm toughened glass', dimensions: 'Custom sizes; standard 90 × 60 cm', weight: '12 kg', care: 'Use glass cleaner; avoid abrasive pads' }
      },
      {
        name: 'Glass Photo Frames',
        slug: 'glass-photo-frames',
        description: 'Charming photo frames with hand-etched and painted glass borders featuring floral and paisley motifs. The frosted glass surround gives photos a soft, diffused glow. Available in multiple sizes to suit any photograph.',
        short_description: 'Hand-etched and painted glass border photo frames.',
        category_slug: 'home-decor',
        price: 1499.00,
        compare_at_price: null,
        icon: '📸',
        stock_quantity: 90,
        is_featured: false,
        tags: ['photo-frames', 'etched-glass', 'home-decor', 'gift'],
        specifications: { material: 'Etched glass border, MDF backing', dimensions: '20 × 25 cm (photo size 13 × 18 cm)', weight: '0.4 kg', care: 'Clean glass with mild glass cleaner' }
      },
      {
        name: 'Blown Glass Ornaments',
        slug: 'blown-glass-ornaments',
        description: 'A festive set of six individually hand-blown glass ornaments in jewel tones. Each ornament is formed by mouth-blowing molten glass into a mould, then painted with metallic accents. Makes a beautiful seasonal decoration or year-round shelf display.',
        short_description: 'Set of 6 hand-blown jewel-tone glass ornaments.',
        category_slug: 'home-decor',
        price: 999.00,
        compare_at_price: 1299.00,
        icon: '🎄',
        stock_quantity: 100,
        is_featured: false,
        tags: ['ornaments', 'hand-blown', 'festive', 'gift'],
        specifications: { material: 'Mouth-blown glass', dimensions: 'Diameter 6 cm each', weight: '0.35 kg (set)', care: 'Handle with care; store in padded box' }
      }
    ];

    for (const p of productData) {
      const catId = categoryIds[p.category_slug];
      await client.query(
        `INSERT INTO products
           (name, slug, description, short_description, category_id, price, compare_at_price,
            icon, stock_quantity, is_featured, tags, specifications)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (slug) DO UPDATE SET
           name=EXCLUDED.name, price=EXCLUDED.price, is_featured=EXCLUDED.is_featured,
           updated_at=NOW()`,
        [
          p.name, p.slug, p.description, p.short_description, catId,
          p.price, p.compare_at_price, p.icon, p.stock_quantity, p.is_featured,
          JSON.stringify(p.tags), JSON.stringify(p.specifications)
        ]
      );
    }
    console.log(`  ✓ ${productData.length} products seeded`);

    // ── Coupons ────────────────────────────────────────────────
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const couponData = [
      { code: 'WELCOME10',  type: 'percentage', value: 10,  min_order_amount: 0,    max_uses: null, expires_at: null },
      { code: 'GLASS500',   type: 'fixed',      value: 500, min_order_amount: 5000, max_uses: null, expires_at: null },
      { code: 'ARTISAN15',  type: 'percentage', value: 15,  min_order_amount: 3000, max_uses: null, expires_at: thirtyDaysFromNow }
    ];

    for (const c of couponData) {
      await client.query(
        `INSERT INTO coupons (code, type, value, min_order_amount, max_uses, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (code) DO UPDATE SET value=EXCLUDED.value, is_active=true`,
        [c.code, c.type, c.value, c.min_order_amount, c.max_uses, c.expires_at]
      );
    }
    console.log(`  ✓ ${couponData.length} coupons seeded`);

    console.log('✦ Seed complete!');
  } catch (e) {
    console.error('Seed error:', e.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
