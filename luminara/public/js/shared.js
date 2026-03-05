// ============================
// CUSTOM CURSOR
// ============================
(function initCursor() {
  // Skip on touch devices
  if ('ontouchstart' in window) return;

  const cursor = document.createElement('div');
  cursor.className = 'cursor';
  cursor.id = 'cursor';

  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.id = 'cursorRing';

  document.body.appendChild(cursor);
  document.body.appendChild(ring);

  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    cursor.style.left = mx + 'px';
    cursor.style.top = my + 'px';
  });

  function animateRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    requestAnimationFrame(animateRing);
  }
  animateRing();

  function attachCursorEffects() {
    document.querySelectorAll('button, a, input, select, textarea, [data-cursor]').forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.style.transform = 'translate(-50%,-50%) scale(2.5)';
        ring.style.transform = 'translate(-50%,-50%) scale(1.5)';
        ring.style.borderColor = 'rgba(201,169,110,0.7)';
      });
      el.addEventListener('mouseleave', () => {
        cursor.style.transform = 'translate(-50%,-50%) scale(1)';
        ring.style.transform = 'translate(-50%,-50%) scale(1)';
        ring.style.borderColor = 'rgba(201,169,110,0.4)';
      });
    });
  }

  document.body.classList.add('js-custom-cursor');

  // Re-attach after DOM changes, debounced to avoid performance issues
  attachCursorEffects();
  let cursorDebounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(cursorDebounceTimer);
    cursorDebounceTimer = setTimeout(attachCursorEffects, 100);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ============================
// SCROLL ANIMATIONS
// ============================
(function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  function observeElements() {
    document.querySelectorAll('.fade-up, .fade-in, .slide-left, .slide-right, .scale-in').forEach(el => {
      if (!el.classList.contains('visible')) {
        observer.observe(el);
      }
    });
  }

  observeElements();

  // Re-observe after dynamic content
  window._reobserveAnimations = observeElements;
})();

// ============================
// CART SYSTEM
// ============================
const Cart = {
  STORAGE_KEY: 'luminara_cart',
  MAX_QTY: 10,
  GST_RATE: 0.18,
  FREE_SHIPPING_THRESHOLD: 5000,
  SHIPPING_COST: 299,

  getCart() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch { return []; }
  },

  saveCart(cart) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { cart } }));
  },

  addToCart(product) {
    // product: { slug, name, price, compare_at_price, icon, category }
    const cart = this.getCart();
    const existing = cart.find(i => i.slug === product.slug);
    if (existing) {
      existing.qty = Math.min(existing.qty + 1, this.MAX_QTY);
    } else {
      cart.push({ ...product, qty: 1 });
    }
    this.saveCart(cart);
  },

  removeFromCart(slug) {
    const cart = this.getCart().filter(i => i.slug !== slug);
    this.saveCart(cart);
  },

  updateQuantity(slug, qty) {
    const cart = this.getCart();
    const item = cart.find(i => i.slug === slug);
    if (item) {
      if (qty <= 0) {
        return this.removeFromCart(slug);
      }
      item.qty = Math.min(qty, this.MAX_QTY);
      this.saveCart(cart);
    }
  },

  clearCart() {
    this.saveCart([]);
  },

  getCartTotal() {
    return this.getCart().reduce((sum, i) => sum + (i.price * i.qty), 0);
  },

  getCartCount() {
    return this.getCart().reduce((sum, i) => sum + i.qty, 0);
  }
};

// ============================
// UTILITY FUNCTIONS
// ============================
function formatPrice(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ============================
// TOAST NOTIFICATIONS
// ============================
(function initToast() {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.id = 'toast';
  toast.innerHTML = `
    <div class="toast-icon" id="toastIcon">✦</div>
    <div class="toast-text">
      <strong id="toastTitle"></strong>
      <span id="toastMsg"></span>
    </div>
  `;
  document.body.appendChild(toast);
})();

let toastTimer;
function showToast(title, message, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastMsg').textContent = message;
  document.getElementById('toastIcon').textContent = type === 'error' ? '✕' : '✦';
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
}

// ============================
// CART DRAWER
// ============================
(function initCartDrawer() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'cart-overlay';
  overlay.id = 'cartOverlay';

  // Create drawer
  const drawer = document.createElement('div');
  drawer.className = 'cart-drawer';
  drawer.id = 'cartDrawer';
  drawer.innerHTML = `
    <div class="cart-drawer-header">
      <h2 class="cart-drawer-title">Your Cart</h2>
      <button class="cart-close" id="cartClose" aria-label="Close cart">✕</button>
    </div>
    <div class="cart-items" id="cartItems"></div>
    <div class="cart-footer">
      <div class="cart-totals" id="cartTotals"></div>
      <a href="/checkout" class="checkout-btn" id="checkoutBtn">Proceed to Checkout</a>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  // Open/close
  window.openCart = function() {
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderCartDrawer();
  };

  window.closeCart = function() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  };

  overlay.addEventListener('click', closeCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);

  // Close on escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCart();
  });

  // Cart button click
  document.addEventListener('click', e => {
    if (e.target.closest('.cart-btn')) {
      e.preventDefault();
      openCart();
    }
  });

  function renderCartDrawer() {
    const cart = Cart.getCart();
    const itemsEl = document.getElementById('cartItems');
    const totalsEl = document.getElementById('cartTotals');

    if (!cart.length) {
      itemsEl.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🛒</div>
          <p>Your cart is empty</p>
          <a href="/shop" class="btn-ghost" style="margin-top:16px;display:inline-block">Browse Collection</a>
        </div>`;
      totalsEl.innerHTML = '';
      document.getElementById('checkoutBtn').style.display = 'none';
      return;
    }

    document.getElementById('checkoutBtn').style.display = 'block';

    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-item" data-slug="${item.slug}">
        <div class="cart-item-icon">${item.icon || '🔮'}</div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${formatPrice(item.price)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" data-action="decrease" data-slug="${item.slug}">−</button>
            <span class="qty-display">${item.qty}</span>
            <button class="qty-btn" data-action="increase" data-slug="${item.slug}">+</button>
          </div>
        </div>
        <button class="cart-remove" data-slug="${item.slug}" aria-label="Remove item">✕</button>
      </div>
    `).join('');

    const subtotal = Cart.getCartTotal();
    const shipping = subtotal >= Cart.FREE_SHIPPING_THRESHOLD ? 0 : Cart.SHIPPING_COST;
    const gst = Math.round(subtotal * Cart.GST_RATE);
    const total = subtotal + shipping + gst;

    totalsEl.innerHTML = `
      <div class="cart-total-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
      <div class="cart-total-row"><span>Shipping</span><span>${shipping === 0 ? '<span style="color:#6ee87a">Free</span>' : formatPrice(shipping)}</span></div>
      <div class="cart-total-row"><span>GST (18%)</span><span>${formatPrice(gst)}</span></div>
      <div class="cart-total-row grand"><span>Total</span><span>${formatPrice(total)}</span></div>
    `;
  }

  // Qty and remove buttons
  document.addEventListener('click', e => {
    const qtyBtn = e.target.closest('.qty-btn');
    const removeBtn = e.target.closest('.cart-remove');

    if (qtyBtn) {
      const slug = qtyBtn.dataset.slug;
      const action = qtyBtn.dataset.action;
      const cart = Cart.getCart();
      const item = cart.find(i => i.slug === slug);
      if (!item) return;
      if (action === 'increase') Cart.updateQuantity(slug, item.qty + 1);
      if (action === 'decrease') Cart.updateQuantity(slug, item.qty - 1);
    }

    if (removeBtn) {
      Cart.removeFromCart(removeBtn.dataset.slug);
    }
  });

  // Re-render on cart update
  window.addEventListener('cart-updated', () => {
    updateCartBadge();
    if (drawer.classList.contains('open')) {
      renderCartDrawer();
    }
  });

  // Initial render
  updateCartBadge();
})();

// ============================
// CART BADGE
// ============================
function updateCartBadge() {
  const count = Cart.getCartCount();
  document.querySelectorAll('.cart-badge').forEach(badge => {
    const prev = parseInt(badge.textContent) || 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'block' : 'none';
    if (prev !== count) {
      badge.classList.remove('bounce');
      void badge.offsetWidth; // reflow
      badge.classList.add('bounce');
    }
  });
}

// ============================
// NAV SCROLL BEHAVIOR
// ============================
(function initNavScroll() {
  const nav = document.querySelector('nav.site-nav');
  if (!nav) return;

  function onScroll() {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// ============================
// MOBILE NAV HAMBURGER
// ============================
(function initMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');
    document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
  });

  // Close on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
})();

// ============================
// SMOOTH SCROLL
// ============================
document.addEventListener('click', e => {
  const link = e.target.closest('a[href^="#"]');
  if (link) {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }
});

// ============================
// NEWSLETTER HANDLER
// ============================
function initNewsletterForms() {
  document.querySelectorAll('.newsletter-form').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const btn = form.querySelector('button[type="submit"]');
      if (!input || !input.value.trim()) return;

      const email = input.value.trim();
      const origText = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = '...'; }

      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Subscribed!', 'Thank you for joining our newsletter.');
          input.value = '';
        } else {
          showToast('Error', data.error || 'Could not subscribe.', 'error');
        }
      } catch {
        showToast('Error', 'Network error. Please try again.', 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText; }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initNewsletterForms);

// ============================
// PAGE TRANSITION
// ============================
(function initPageTransitions() {
  const overlay = document.createElement('div');
  overlay.className = 'page-transition';
  overlay.id = 'pageTransition';
  document.body.appendChild(overlay);

  // Fade in on load
  window.addEventListener('load', () => {
    overlay.classList.remove('active');
  });

  // Intercept internal links
  document.addEventListener('click', e => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || link.target === '_blank') return;
    // Skip if already on same page
    if (href === window.location.pathname) return;

    e.preventDefault();
    overlay.classList.add('active');
    setTimeout(() => { window.location.href = href; }, 300);
  });
})();

// ============================
// ACTIVE NAV LINK
// ============================
(function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('nav.site-nav .nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === path || (path === '/' && href === '/') || (path !== '/' && href !== '/' && path.startsWith(href))) {
      link.classList.add('active');
    }
  });
})();
