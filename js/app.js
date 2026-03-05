// BrewPOS Main App
'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let STATE = {
  view: 'pos',
  products: [],
  ingredients: [],
  orders: [],
  customers: [],
  settings: { ...DEFAULT_SETTINGS },
  kitchenQueue: [],
  // POS
  cat: 'All',
  search: '',
  selectedSize: 'M',
  cart: [],
  payMethod: 'cash',
  cashIn: '',
  discount: 0,
  customerPhone: '',
  customerName: '',
  foundCustomer: null,
  // Kitchen clock
  kitchenTick: 0,
  // Orders filter
  ordersSearch: '',
  ordersDateFilter: todayStr(),
  // Inventory tab
  invTab: 'stock',
  // PIN
  pinUnlocked: false,
  // Modal
  modal: null,
};

let orderSeq = 1001;
let kitchenInterval = null;

// ── DOM helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
function qs(sel, parent = document) { return parent.querySelector(sel); }

// ── Toast ────────────────────────────────────────────────────────────────────
let toastContainer = null;
function toast(msg, type = 'success', duration = 2500) {
  if (!toastContainer) {
    toastContainer = el('div', 'toast-container');
    document.body.appendChild(toastContainer);
  }
  const t = el('div', `toast ${type}`, msg);
  toastContainer.appendChild(t);
  setTimeout(() => t.style.opacity = '0', duration - 300);
  setTimeout(() => t.remove(), duration);
}

// ── Modal ────────────────────────────────────────────────────────────────────
function showModal(html, onClose) {
  closeModal();
  const overlay = el('div', 'modal-overlay');
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  STATE.modal = { onClose };
}
function closeModal() {
  const existing = $('modal-overlay');
  if (existing) existing.remove();
  STATE.modal = null;
}

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  try {
    await DB.open();
    await seedIfEmpty();
    await loadAll();
    startKitchenClock();
    renderApp();
    // Hide splash after short delay
    setTimeout(() => {
      const splash = $('splash');
      if (splash) { splash.style.opacity = '0'; splash.style.transition = 'opacity .4s'; setTimeout(() => splash.remove(), 400); }
    }, 1200);
  } catch (err) {
    console.error('Init error:', err);
    // Fallback: use memory-only mode
    STATE.products = DEFAULT_PRODUCTS.map(p => ({ ...p }));
    STATE.ingredients = DEFAULT_INGREDIENTS.map(i => ({ ...i }));
    renderApp();
    setTimeout(() => { const s = $('splash'); if (s) s.remove(); }, 1200);
  }
}

async function seedIfEmpty() {
  const prods = await DB.getAll('products');
  if (prods.length === 0) {
    for (const p of DEFAULT_PRODUCTS) await DB.put('products', p);
  }
  const ings = await DB.getAll('ingredients');
  if (ings.length === 0) {
    for (const i of DEFAULT_INGREDIENTS) await DB.put('ingredients', i);
  }
  // Settings
  for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
    const existing = await DB.get('settings', key);
    if (!existing) await DB.setSetting(key, val);
  }
}

async function loadAll() {
  STATE.products = await DB.getAll('products');
  STATE.ingredients = await DB.getAll('ingredients');
  STATE.orders = await DB.getAll('orders');
  STATE.customers = await DB.getAll('customers');
  STATE.kitchenQueue = await DB.getAll('kitchen');
  // Load settings
  const keys = Object.keys(DEFAULT_SETTINGS);
  for (const k of keys) {
    const v = await DB.getSetting(k, DEFAULT_SETTINGS[k]);
    STATE.settings[k] = v;
  }
  // Restore order sequence
  if (STATE.orders.length > 0) {
    orderSeq = Math.max(...STATE.orders.map(o => o.id || 1000)) + 1;
  }
}

// ── Render App Shell ─────────────────────────────────────────────────────────
function renderApp() {
  const app = $('app');
  app.innerHTML = `
    <div id="topbar">
      <span class="tb-logo">☕ ${STATE.settings.storeName || 'BrewPOS'}</span>
      <span class="tb-date" id="tb-date">${dateLabel(todayStr())}</span>
      <nav class="tb-nav">
        <button class="tb-btn ${STATE.view==='pos'?'active':''}" onclick="setView('pos')">🛒 POS</button>
        <button class="tb-btn ${STATE.view==='kitchen'?'active':''}" onclick="setView('kitchen')">👨‍🍳 Kitchen</button>
        <button class="tb-btn ${STATE.view==='orders'?'active':''}" onclick="setView('orders')">📋 Orders</button>
        <button class="tb-btn ${STATE.view==='inventory'?'active':''}" onclick="setView('inventory')">📦 Inventory ${isProtected('inventory')&&!STATE.pinUnlocked?'🔒':''}</button>
        <button class="tb-btn ${STATE.view==='products'?'active':''}" onclick="setView('products')">🍹 Products ${isProtected('products')&&!STATE.pinUnlocked?'🔒':''}</button>
        <button class="tb-btn ${STATE.view==='customers'?'active':''}" onclick="setView('customers')">👥 Customers ${isProtected('customers')&&!STATE.pinUnlocked?'🔒':''}</button>
        <button class="tb-btn ${STATE.view==='summary'?'active':''}" onclick="setView('summary')">📊 Summary ${isProtected('summary')&&!STATE.pinUnlocked?'🔒':''}</button>
        <button class="tb-btn ${STATE.view==='settings'?'active':''}" onclick="setView('settings')">⚙️ Settings ${isProtected('settings')&&!STATE.pinUnlocked?'🔒':''}</button>
      </nav>
      ${STATE.settings.pinEnabled && STATE.settings.adminPin ? `
        <button onclick="lockApp()" title="Lock admin sections" style="
          background:${STATE.pinUnlocked?'rgba(233,69,96,.15)':'rgba(245,166,35,.1)'};
          border:1px solid ${STATE.pinUnlocked?'var(--red)':'var(--border)'};
          border-radius:8px;padding:6px 12px;color:${STATE.pinUnlocked?'var(--red)':'var(--muted)'};
          font-size:12px;cursor:pointer;white-space:nowrap;font-family:var(--font-body);transition:all .2s;
        ">${STATE.pinUnlocked ? '🔓 Lock' : '🔒 Locked'}</button>
      ` : ''}
      <div class="tb-stat">
        <div class="tb-stat-val" id="tb-sales">${peso(todaySales())}</div>
        <div class="tb-stat-lbl">Today's Sales</div>
      </div>
    </div>
    <div id="main"></div>
    <nav id="bottom-nav">
      <div class="bnav-inner">
        <button class="bnav-btn ${STATE.view==='pos'?'active':''}" onclick="setView('pos')">
          <span class="bnav-icon">🛒</span><span class="bnav-label">POS</span>
        </button>
        <button class="bnav-btn ${STATE.view==='kitchen'?'active':''}" onclick="setView('kitchen')">
          <span class="bnav-icon">👨‍🍳</span><span class="bnav-label">Kitchen</span>
        </button>
        <button class="bnav-btn ${STATE.view==='orders'?'active':''}" onclick="setView('orders')">
          <span class="bnav-icon">📋</span><span class="bnav-label">Orders</span>
        </button>
        <button class="bnav-btn ${STATE.view==='inventory'?'active':''}" onclick="setView('inventory')">
          <span class="bnav-icon">📦</span><span class="bnav-label">Inventory${isProtected('inventory')&&!STATE.pinUnlocked?' 🔒':''}</span>
        </button>
        <button class="bnav-btn ${STATE.view==='products'?'active':''}" onclick="setView('products')">
          <span class="bnav-icon">🍹</span><span class="bnav-label">Products${isProtected('products')&&!STATE.pinUnlocked?' 🔒':''}</span>
        </button>
        <button class="bnav-btn ${STATE.view==='customers'?'active':''}" onclick="setView('customers')">
          <span class="bnav-icon">👥</span><span class="bnav-label">Customers${isProtected('customers')&&!STATE.pinUnlocked?' 🔒':''}</span>
        </button>
        <button class="bnav-btn ${STATE.view==='summary'?'active':''}" onclick="setView('summary')">
          <span class="bnav-icon">📊</span><span class="bnav-label">Summary${isProtected('summary')&&!STATE.pinUnlocked?' 🔒':''}</span>
        </button>
        <button class="bnav-btn ${STATE.view==='settings'?'active':''}" onclick="setView('settings')">
          <span class="bnav-icon">${STATE.settings.pinEnabled&&STATE.settings.adminPin?(STATE.pinUnlocked?'🔓':'🔒'):'⚙️'}</span>
          <span class="bnav-label">Settings</span>
        </button>
        ${STATE.settings.pinEnabled && STATE.settings.adminPin ? `
        <button class="bnav-btn" onclick="lockApp()" style="color:${STATE.pinUnlocked?'var(--red)':'var(--muted)'}">
          <span class="bnav-icon">${STATE.pinUnlocked?'🔓':'🔒'}</span>
          <span class="bnav-label">${STATE.pinUnlocked?'Lock':'Locked'}</span>
        </button>` : ''}
      </div>
    </nav>
  `;
  renderView();
}

function updateTopbar() {
  const el1 = $('tb-sales');
  if (el1) el1.textContent = peso(todaySales());
}

// ── PIN Protection ────────────────────────────────────────────────────────────
const PROTECTED_VIEWS = ['inventory', 'products', 'customers', 'summary', 'settings'];

function isProtected(v) {
  return PROTECTED_VIEWS.includes(v) && STATE.settings.pinEnabled && STATE.settings.adminPin;
}

function setView(v) {
  if (isProtected(v) && !STATE.pinUnlocked) {
    showPinModal(v);
    return;
  }
  STATE.view = v;
  renderApp();
}

function lockApp() {
  STATE.pinUnlocked = false;
  // If currently on a protected view, bounce back to POS
  if (PROTECTED_VIEWS.includes(STATE.view)) {
    STATE.view = 'pos';
  }
  renderApp();
  toast('🔒 Locked', 'info', 1500);
}

function showPinModal(targetView) {
  showModal(`
    <div style="text-align:center;padding:10px 0 4px;">
      <div style="font-size:36px;margin-bottom:8px;">🔒</div>
      <div class="modal-title" style="text-align:center;margin-bottom:4px;">Admin PIN Required</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:20px;">Enter your PIN to access this section</div>
    </div>
    <div id="pin-dots" style="display:flex;justify-content:center;gap:12px;margin-bottom:20px;">
      ${[0,1,2,3,4,5].map(i=>`<div id="pd-${i}" style="width:14px;height:14px;border-radius:50%;background:var(--border);transition:background .15s;"></div>`).join('')}
    </div>
    <div id="pin-error" style="text-align:center;font-size:12px;color:var(--red);min-height:18px;margin-bottom:8px;"></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:240px;margin:0 auto;">
      ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => `
        <button onclick="pinKey('${k}','${targetView}')" style="
          padding:16px;font-size:20px;font-weight:600;border-radius:10px;
          background:${k===''?'transparent':'var(--card)'};
          border:${k===''?'none':'1.5px solid var(--border)'};
          color:var(--text);cursor:${k===''?'default':'pointer'};
          transition:all .1s;font-family:var(--font-body);
          ${k===''?'pointer-events:none;':''}
        ">${k}</button>
      `).join('')}
    </div>
    <div style="text-align:center;margin-top:16px;">
      <button class="modal-btn secondary" style="padding:8px 24px;" onclick="closeModal()">Cancel</button>
    </div>
  `);
  window._pinBuffer = '';
}

function pinKey(k, targetView) {
  if (k === '') return;
  const buf = window._pinBuffer || '';
  if (k === '⌫') {
    window._pinBuffer = buf.slice(0, -1);
  } else if (buf.length < 6) {
    window._pinBuffer = buf + k;
  }
  // Update dots
  const len = window._pinBuffer.length;
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById(`pd-${i}`);
    if (dot) dot.style.background = i < len ? 'var(--accent)' : 'var(--border)';
  }
  // Auto-check when enough digits entered
  const pinLen = STATE.settings.adminPin.length || 4;
  if (window._pinBuffer.length >= pinLen) {
    if (window._pinBuffer === STATE.settings.adminPin) {
      STATE.pinUnlocked = true;
      closeModal();
      STATE.view = targetView;
      renderApp();
      toast('🔓 Unlocked', 'success', 1500);
    } else {
      document.getElementById('pin-error').textContent = '❌ Wrong PIN, try again';
      window._pinBuffer = '';
      for (let i = 0; i < 6; i++) {
        const dot = document.getElementById(`pd-${i}`);
        if (dot) { dot.style.background = 'var(--red)'; }
      }
      setTimeout(() => {
        for (let i = 0; i < 6; i++) {
          const dot = document.getElementById(`pd-${i}`);
          if (dot) dot.style.background = 'var(--border)';
        }
        const err = document.getElementById('pin-error');
        if (err) err.textContent = '';
      }, 800);
    }
  }
}



function renderView() {
  const main = $('main');
  if (!main) return;
  switch (STATE.view) {
    case 'pos':       renderPOS(main); break;
    case 'kitchen':   renderKitchen(main); break;
    case 'orders':    renderOrders(main); break;
    case 'inventory': renderInventory(main); break;
    case 'products':  renderProductsMgmt(main); break;
    case 'customers': renderCustomers(main); break;
    case 'summary':   renderSummary(main); break;
    case 'settings':  renderSettings(main); break;
  }
}

// ── POS VIEW ─────────────────────────────────────────────────────────────────
function renderPOS(container) {
  container.innerHTML = `
    <div id="pos">
      <div id="product-panel">
        <div id="search-bar">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input id="prod-search" placeholder="Search products…" value="${STATE.search}" oninput="onSearch(this.value)"/>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
            <span style="font-size:11px;color:var(--muted);white-space:nowrap;">Size:</span>
            <div class="size-btns">
              ${SIZES.map(s => `<button class="sz-btn ${STATE.selectedSize===s?'active':''}" data-size="${s}" onclick="setSize('${s}')">${s}</button>`).join('')}
            </div>
            <span id="selected-size-lbl" style="font-size:11px;color:var(--accent);font-weight:600;min-width:52px;">${SIZE_LABELS[STATE.selectedSize]}</span>
          </div>
        </div>
        <div id="cat-bar">
          ${CATEGORIES.map(c => `<button class="cat-chip ${STATE.cat===c?'active':''}" onclick="setCat('${c}')">${c}</button>`).join('')}
        </div>
        <div id="product-grid"><div class="grid" id="prod-grid"></div></div>
      </div>
      <div id="cart-panel">
        <div class="cart-hdr">
          <span class="cart-title">🛒 Current Order</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <span class="cart-count" id="cart-count">${STATE.cart.length} items</span>
            <button class="sz-btn" onclick="clearCart()">Clear</button>
          </div>
        </div>
        <div id="cust-bar">
          <input class="cust-inp" id="cust-phone" placeholder="📱 Phone / Name" value="${STATE.customerPhone}"
            oninput="onCustSearch(this.value)" autocomplete="off"/>
          <button class="cust-btn" onclick="lookupCustomer()">Lookup</button>
        </div>
        <div id="cust-info-bar"></div>
        <div id="cart-items"></div>
        <div id="cart-footer"></div>
      </div>
    </div>
  `;
  renderProductGrid();
  renderCartItems();
  renderCartFooter();
  renderCustInfo();
}

function renderProductGrid() {
  const grid = $('prod-grid');
  if (!grid) return;
  const products = STATE.products.filter(p =>
    p.active !== false &&
    (STATE.cat === 'All' || p.cat === STATE.cat) &&
    p.name.toLowerCase().includes(STATE.search.toLowerCase())
  );
  if (products.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">No products found</div>`;
    return;
  }
  grid.innerHTML = products.map(p => {
    const key = `${p.id}-${STATE.selectedSize}`;
    const inCart = STATE.cart.find(i => i.key === key);
    const price = p.prices[STATE.selectedSize] || 0;
    const ingStatus = checkStock(p);
    return `
      <div class="prod-card ${inCart ? 'in-cart' : ''} ${ingStatus === 'out' ? 'out-of-stock' : ''}"
           onclick="addToCart(${p.id})" style="border-color:${inCart ? p.color : 'transparent'}">
        <div class="prod-top-bar" style="background:${p.color}"></div>
        ${inCart ? `<div class="prod-badge" style="background:${p.color}">${inCart.qty}</div>` : ''}
        <div class="prod-emoji">${p.emoji}</div>
        <div class="prod-name">${p.name}</div>
        <div class="prod-cat">${p.cat}</div>
        <div class="prod-price" style="color:${p.color||'var(--accent)'};">${peso(price)}</div>
        <div style="display:flex;gap:3px;margin-top:5px;justify-content:center;">
          ${SIZES.map(s => `<span style="font-size:9px;padding:2px 4px;border-radius:4px;${s===STATE.selectedSize?`background:${p.color||'var(--accent)'};color:#000;font-weight:700`:'color:var(--muted2)'}">${s}</span>`).join('')}
        </div>
        ${ingStatus === 'out' ? '<div class="out-label">Out</div>' : ''}
      </div>
    `;
  }).join('');
}

function checkStock(product) {
  // Quick check if any key ingredient is out
  if (!product.recipe || product.recipe.length === 0) return 'ok';
  for (const r of product.recipe) {
    const ing = STATE.ingredients.find(i => i.id === r.ingId);
    if (ing && ing.stock <= 0) return 'out';
    if (ing && ing.stock < r.qty) return 'low';
  }
  return 'ok';
}

function renderCartItems() {
  const el1 = $('cart-items');
  if (!el1) return;
  if (STATE.cart.length === 0) {
    el1.innerHTML = `<div class="cart-empty"><div class="big">🧋</div><div>Cart is empty</div><div style="font-size:11px;color:var(--muted2)">Tap a product to add</div></div>`;
    return;
  }
  el1.innerHTML = STATE.cart.map(item => `
    <div class="cart-row">
      <span class="cart-emoji">${item.emoji}</span>
      <div class="cart-info">
        <div class="cart-iname">${item.name}</div>
        <div class="cart-imeta">${SIZE_LABELS[item.size]} · ${peso(item.price)}
          ${item.note ? `<span style="color:var(--blue)"> · ${item.note}</span>` : ''}
        </div>
        <button class="cart-note-btn" onclick="addItemNote('${item.key}')">+ note</button>
      </div>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="changeQty('${item.key}',-1)">−</button>
        <span class="qty-num">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty('${item.key}',1)">+</button>
      </div>
      <div class="cart-price">${peso(item.price * item.qty)}</div>
      <button class="del-btn" onclick="removeFromCart('${item.key}')">✕</button>
    </div>
  `).join('');
  const cc = $('cart-count');
  if (cc) cc.textContent = STATE.cart.length + ' items';
}

function renderCartFooter() {
  const footer = $('cart-footer');
  if (!footer) return;
  const subtotal = cartSubtotal();
  const discAmt = subtotal * (STATE.discount / 100);
  const total = subtotal - discAmt;
  const cashInNum = Number(STATE.cashIn) || 0;
  const change = cashInNum - total;
  const loyPts = STATE.foundCustomer ? Math.floor(total * STATE.settings.loyaltyRate) : 0;

  let payExtra = '';
  if (STATE.payMethod === 'cash') {
    const qcAmts = [...new Set([total, Math.ceil(total/50)*50, Math.ceil(total/100)*100, Math.ceil(total/500)*500])].slice(0,4);
    payExtra = `
      <div class="cash-row">
        <span class="cash-lbl">Cash In ₱</span>
        <input class="cash-inp" id="cash-in" type="number" value="${STATE.cashIn}" placeholder="0.00"
          oninput="STATE.cashIn=this.value;renderCartFooter()"/>
      </div>
      ${total > 0 ? `<div class="quick-cash">${qcAmts.map(v => `<button class="qc-btn" onclick="setCashIn(${v})">${v>=1000?'₱'+(v/1000)+'k':'₱'+v}</button>`).join('')}</div>` : ''}
      ${STATE.cashIn ? `<div class="change-row ${change>=0?'change-pos':'change-neg'}">${change>=0?'Change: '+peso(change):'Short: '+peso(-change)}</div>` : ''}
    `;
  } else if (STATE.payMethod === 'gcash' || STATE.payMethod === 'maya') {
    payExtra = `
      <div class="gcash-box">
        <div class="gcash-title">${STATE.payMethod==='gcash'?'GCash':'Maya'} Number</div>
        <div class="gcash-num">${STATE.settings.gcashNumber}</div>
        <div class="gcash-name">${STATE.settings.gcashName}</div>
        <div style="margin-top:6px;font-size:13px;color:var(--accent);font-weight:700;">Amount: ${peso(total)}</div>
      </div>
    `;
  } else if (STATE.payMethod === 'bank') {
    payExtra = `
      <div class="gcash-box">
        <div class="gcash-title">${STATE.settings.bankName} Transfer</div>
        <div class="gcash-num">${STATE.settings.bankAccount}</div>
        <div class="gcash-name">${STATE.settings.bankAccountName}</div>
        <div style="margin-top:6px;font-size:13px;color:var(--accent);font-weight:700;">Amount: ${peso(total)}</div>
      </div>
    `;
  }

  const canCheckout = STATE.cart.length > 0 &&
    (STATE.payMethod !== 'cash' || !STATE.cashIn || Number(STATE.cashIn) >= total);

  footer.innerHTML = `
    <div class="discount-row">
      <span class="disc-lbl">Discount %</span>
      <input class="disc-inp" type="number" min="0" max="100" value="${STATE.discount}"
        oninput="STATE.discount=Math.min(100,Math.max(0,+this.value));renderCartFooter()"/>
      ${discAmt > 0 ? `<span class="disc-amt">-${peso(discAmt)}</span>` : ''}
    </div>
    <div class="totals-row"><span>Subtotal</span><span>${peso(subtotal)}</span></div>
    ${discAmt > 0 ? `<div class="totals-row" style="color:var(--red)"><span>Discount (${STATE.discount}%)</span><span>-${peso(discAmt)}</span></div>` : ''}
    ${loyPts > 0 ? `<div class="totals-row" style="color:var(--accent)"><span>Loyalty Points Earned</span><span>+${loyPts} pts</span></div>` : ''}
    <div class="totals-grand"><span>TOTAL</span><span>${peso(total)}</span></div>
    <div class="pay-methods">
      ${PAY_METHODS.map(p => `
        <button class="pay-btn ${STATE.payMethod===p.id?'active':''}" onclick="setPayMethod('${p.id}')">
          <span class="pay-icon">${p.icon}</span>${p.label}
        </button>`).join('')}
    </div>
    ${payExtra}
    <button class="checkout-btn" onclick="checkout()" ${canCheckout?'':'disabled'}>
      ✓ CHARGE ${STATE.cart.length > 0 ? peso(total) : ''}
    </button>
  `;
}

function renderCustInfo() {
  const bar = $('cust-info-bar');
  if (!bar) return;
  if (!STATE.foundCustomer) { bar.innerHTML = ''; return; }
  const c = STATE.foundCustomer;
  const pts = c.loyaltyPoints || 0;
  const nextReward = STATE.settings.loyaltyRedeem * 100;
  bar.innerHTML = `
    <div style="padding:7px 12px;background:rgba(78,168,222,.07);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;">
      <div class="cust-avatar" style="width:30px;height:30px;font-size:13px;background:${AVATAR_COLORS[c.id % AVATAR_COLORS.length]}">${c.name.slice(0,2).toUpperCase()}</div>
      <div>
        <div style="font-size:12px;font-weight:600">${c.name}</div>
        <div style="font-size:10px;color:var(--muted)">${c.visits||0} visits</div>
      </div>
      <div style="margin-left:auto;text-align:right">
        <span class="loyalty-badge">★ ${pts} pts</span>
        <div style="font-size:10px;color:var(--muted);margin-top:2px">${Math.round((pts/nextReward)*100)}% to reward</div>
      </div>
    </div>
  `;
}

// ── POS Actions ───────────────────────────────────────────────────────────────
function onSearch(v) { STATE.search = v; renderProductGrid(); }
function setCat(c) { STATE.cat = c; renderProductGrid(); }
function setSize(s) {
  STATE.selectedSize = s;
  document.querySelectorAll('.sz-btn[data-size]').forEach(b => {
    b.classList.toggle('active', b.dataset.size === s);
  });
  const lbl = document.getElementById('selected-size-lbl');
  if (lbl) lbl.textContent = SIZE_LABELS[s];
  renderProductGrid();
  renderCartFooter();
}
function setPayMethod(m) { STATE.payMethod = m; STATE.cashIn = ''; renderCartFooter(); }
function setCashIn(v) { STATE.cashIn = String(v); renderCartFooter(); }
function clearCart() { STATE.cart = []; STATE.discount = 0; STATE.cashIn = ''; renderCartItems(); renderCartFooter(); }

function addToCart(prodId) {
  const p = STATE.products.find(x => x.id === prodId);
  if (!p) return;
  const key = `${p.id}-${STATE.selectedSize}`;
  const price = p.prices[STATE.selectedSize] || 0;
  const ex = STATE.cart.find(i => i.key === key);
  if (ex) { ex.qty++; }
  else { STATE.cart.push({ key, id: p.id, name: p.name, size: STATE.selectedSize, price, qty: 1, emoji: p.emoji, color: p.color, note: '' }); }
  renderCartItems();
  renderCartFooter();
  renderProductGrid();
}

function removeFromCart(key) {
  STATE.cart = STATE.cart.filter(i => i.key !== key);
  renderCartItems(); renderCartFooter(); renderProductGrid();
}

function changeQty(key, delta) {
  STATE.cart = STATE.cart.map(i => {
    if (i.key !== key) return i;
    const newQty = i.qty + delta;
    if (newQty <= 0) return null;
    return { ...i, qty: newQty };
  }).filter(Boolean);
  renderCartItems(); renderCartFooter(); renderProductGrid();
}

function addItemNote(key) {
  const item = STATE.cart.find(i => i.key === key);
  if (!item) return;
  showModal(`
    <div class="modal-title">📝 Item Note</div>
    <div class="modal-label">Note for ${item.name} (${SIZE_LABELS[item.size]})</div>
    <textarea class="modal-note-inp" id="note-inp" rows="3" placeholder="e.g. Less sugar, no ice…">${item.note || ''}</textarea>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" onclick="saveItemNote('${key}')">Save</button>
    </div>
  `);
}
function saveItemNote(key) {
  const note = $('note-inp').value;
  STATE.cart = STATE.cart.map(i => i.key === key ? { ...i, note } : i);
  closeModal();
  renderCartItems();
}

function onCustSearch(v) {
  STATE.customerPhone = v;
  if (!v) { STATE.foundCustomer = null; renderCustInfo(); return; }
  const found = STATE.customers.find(c =>
    c.phone.includes(v) || c.name.toLowerCase().includes(v.toLowerCase())
  );
  STATE.foundCustomer = found || null;
  renderCustInfo();
}

function lookupCustomer() {
  const v = STATE.customerPhone;
  if (!v) { showAddCustomerModal(); return; }
  const found = STATE.customers.find(c =>
    c.phone === v || c.name.toLowerCase() === v.toLowerCase()
  );
  if (found) { STATE.foundCustomer = found; renderCustInfo(); toast(`Welcome back, ${found.name}! ★ ${found.loyaltyPoints||0} pts`, 'info'); }
  else { showAddCustomerModal(v); }
}

function showAddCustomerModal(prefill = '') {
  showModal(`
    <div class="modal-title">👤 Add Customer</div>
    <div class="modal-label">Name</div>
    <input class="modal-inp" id="new-cust-name" placeholder="Customer name"/>
    <div class="modal-label">Phone</div>
    <input class="modal-inp" id="new-cust-phone" placeholder="09XXXXXXXXX" value="${prefill}"/>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" onclick="addNewCustomer()">Add Customer</button>
    </div>
  `);
}

async function addNewCustomer() {
  const name = $('new-cust-name').value.trim();
  const phone = $('new-cust-phone').value.trim();
  if (!name) return toast('Name required', 'error');
  const cust = { name, phone, loyaltyPoints: 0, totalSpent: 0, visits: 0, joinDate: todayStr() };
  const id = await DB.add('customers', cust);
  cust.id = id;
  STATE.customers.push(cust);
  STATE.foundCustomer = cust;
  STATE.customerPhone = phone || name;
  closeModal();
  renderCustInfo();
  toast(`Customer ${name} added!`);
}

function cartSubtotal() { return STATE.cart.reduce((s, i) => s + i.price * i.qty, 0); }

async function checkout() {
  if (!STATE.cart.length) return;
  const subtotal = cartSubtotal();
  const discAmt = subtotal * (STATE.discount / 100);
  const total = subtotal - discAmt;
  const cashInNum = Number(STATE.cashIn) || total;

  const order = {
    id: orderSeq++,
    date: todayStr(),
    time: nowTime(),
    items: STATE.cart.map(i => ({ ...i })),
    subtotal,
    discount: discAmt,
    total,
    payMethod: STATE.payMethod,
    cashIn: cashInNum,
    change: Math.max(0, cashInNum - total),
    status: 'done',
    customerId: STATE.foundCustomer ? STATE.foundCustomer.id : null,
    customerName: STATE.foundCustomer ? STATE.foundCustomer.name : '',
  };

  // Save order
  await DB.put('orders', order);
  STATE.orders.push(order);

  // Deduct stock
  if (STATE.settings.autoDeductStock) {
    await deductStock(order.items);
  }

  // Update customer loyalty
  if (STATE.foundCustomer) {
    const pts = Math.floor(total * STATE.settings.loyaltyRate);
    STATE.foundCustomer.loyaltyPoints = (STATE.foundCustomer.loyaltyPoints || 0) + pts;
    STATE.foundCustomer.totalSpent = (STATE.foundCustomer.totalSpent || 0) + total;
    STATE.foundCustomer.visits = (STATE.foundCustomer.visits || 0) + 1;
    await DB.put('customers', STATE.foundCustomer);
    const cidx = STATE.customers.findIndex(c => c.id === STATE.foundCustomer.id);
    if (cidx >= 0) STATE.customers[cidx] = { ...STATE.foundCustomer };
  }

  // Add to kitchen queue
  const kEntry = {
    orderId: order.id,
    time: order.time,
    startedAt: Date.now(),
    items: order.items,
    customerName: order.customerName,
    status: 'new',
  };
  await DB.put('kitchen', kEntry);
  STATE.kitchenQueue.push(kEntry);

  // Reset cart
  const savedOrder = { ...order };
  STATE.cart = [];
  STATE.cashIn = '';
  STATE.discount = 0;
  STATE.customerPhone = '';
  STATE.foundCustomer = null;

  updateTopbar();
  renderCartItems();
  renderCartFooter();
  renderCustInfo();
  renderProductGrid();
  showReceiptModal(savedOrder);
  toast(`Order #${savedOrder.id} charged! ${peso(savedOrder.total)}`, 'success');
}

async function deductStock(items) {
  for (const item of items) {
    const prod = STATE.products.find(p => p.id === item.id);
    if (!prod || !prod.recipe) continue;
    for (const r of prod.recipe) {
      const ing = STATE.ingredients.find(i => i.id === r.ingId);
      if (ing) {
        ing.stock = Math.max(0, ing.stock - r.qty * item.qty);
        await DB.put('ingredients', ing);
      }
    }
  }
}

function showReceiptModal(order) {
  const loyPts = order.customerId ? Math.floor(order.total * STATE.settings.loyaltyRate) : 0;
  showModal(`
    <div class="receipt-brand">
      <div class="logo">☕ ${STATE.settings.storeName}</div>
      <div class="sub">${STATE.settings.storeAddress}</div>
      <div class="sub">Order #${order.id} · ${order.date} ${order.time}</div>
      ${order.customerName ? `<div class="sub">Customer: ${order.customerName}</div>` : ''}
    </div>
    <hr class="modal-divider"/>
    ${order.items.map(i => `
      <div class="modal-item-row">
        <span>${i.emoji} ${i.name} (${SIZE_LABELS[i.size]}) x${i.qty}${i.note?` · ${i.note}`:''}</span>
        <span>${peso(i.price * i.qty)}</span>
      </div>`).join('')}
    <hr class="modal-divider"/>
    <div class="modal-row"><span>Subtotal</span><span>${peso(order.subtotal)}</span></div>
    ${order.discount > 0 ? `<div class="modal-row red"><span>Discount</span><span>-${peso(order.discount)}</span></div>` : ''}
    <div class="modal-row big"><span>TOTAL</span><span>${peso(order.total)}</span></div>
    <div class="modal-row"><span>${PAY_METHODS.find(p=>p.id===order.payMethod)?.label || order.payMethod}</span><span>${peso(order.cashIn)}</span></div>
    ${order.payMethod === 'cash' ? `<div class="modal-row green"><span>Change</span><span>${peso(order.change)}</span></div>` : ''}
    ${loyPts > 0 ? `<div class="modal-row" style="color:var(--accent)"><span>Points Earned</span><span>+${loyPts} pts</span></div>` : ''}
    <div style="text-align:center;margin-top:14px;font-size:12px;color:var(--muted)">Thank you! Come again ☕</div>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Close</button>
      <button class="modal-btn primary" onclick="setView('kitchen');closeModal()">👨‍🍳 View Kitchen</button>
    </div>
  `);
}

// ── KITCHEN DISPLAY ───────────────────────────────────────────────────────────
function startKitchenClock() {
  if (kitchenInterval) clearInterval(kitchenInterval);
  kitchenInterval = setInterval(() => {
    STATE.kitchenTick++;
    // Update elapsed times in kitchen if visible
    if (STATE.view === 'kitchen') {
      document.querySelectorAll('.kd-elapsed').forEach(el => {
        const orderId = parseInt(el.dataset.orderId);
        const entry = STATE.kitchenQueue.find(k => k.orderId === orderId);
        if (entry) {
          const mins = Math.floor((Date.now() - entry.startedAt) / 60000);
          el.textContent = mins + 'm';
          el.className = 'kd-elapsed' + (mins >= 10 ? ' urgent' : mins >= 5 ? ' warn' : '');
        }
      });
    }
  }, 10000);
}

function renderKitchen(container) {
  const active = STATE.kitchenQueue.filter(k => k.status !== 'done');
  container.innerHTML = `
    <div id="kitchen">
      <div class="kd-hdr">
        <span class="kd-title">👨‍🍳 Kitchen Display</span>
        <span style="font-size:12px;color:#4a6080">${active.length} order${active.length!==1?'s':''} pending</span>
        <span class="kd-time" id="kd-clock">${new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
      </div>
      <div class="kd-queue">
        ${active.length === 0 ? '<div class="kd-empty"><div class="big">✅</div><div style="color:#1a5030;font-size:13px">All orders done!</div></div>' : ''}
        ${active.map(k => renderKitchenCard(k)).join('')}
      </div>
    </div>
  `;
  // Live clock
  setInterval(() => {
    const clk = $('kd-clock');
    if (clk) clk.textContent = new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }, 1000);
}

function renderKitchenCard(k) {
  const mins = Math.floor((Date.now() - k.startedAt) / 60000);
  const cls = k.status === 'new' ? 'kd-new' : '';
  return `
    <div class="kd-card ${cls}" id="kd-${k.orderId}">
      <div class="kd-card-hdr">
        <span class="kd-order-num">#${k.orderId}</span>
        ${k.customerName ? `<span style="font-size:10px;color:#4a8ab0">${k.customerName}</span>` : ''}
        <span class="kd-time-chip">${k.time}</span>
        <span class="kd-elapsed ${mins>=10?'urgent':mins>=5?'warn':''}" data-order-id="${k.orderId}">${mins}m</span>
      </div>
      ${k.customerName ? `<div class="kd-customer">${k.customerName}</div>` : ''}
      <div class="kd-items">
        ${k.items.map((item,idx) => `
          <div class="kd-item" id="kdi-${k.orderId}-${idx}" onclick="toggleKitchenItem(${k.orderId},${idx})">
            <span class="kd-item-emoji">${item.emoji}</span>
            <div class="kd-item-info">
              <div class="kd-item-name">${item.name}</div>
              <div class="kd-item-meta">${SIZE_LABELS[item.size] || item.size}${item.note?' · '+item.note:''}</div>
            </div>
            <span class="kd-item-qty">×${item.qty}</span>
          </div>`).join('')}
      </div>
      <div class="kd-actions">
        <button class="kd-done-btn" onclick="kitchenDone(${k.orderId})">✓ Done</button>
        <button class="kd-bump-btn" onclick="kitchenBump(${k.orderId})">Bump</button>
      </div>
    </div>
  `;
}

function toggleKitchenItem(orderId, idx) {
  const el1 = $(`kdi-${orderId}-${idx}`);
  if (el1) el1.querySelector('.kd-item-name').classList.toggle('kd-item-done');
}

async function kitchenDone(orderId) {
  const idx = STATE.kitchenQueue.findIndex(k => k.orderId === orderId);
  if (idx < 0) return;
  STATE.kitchenQueue[idx].status = 'done';
  await DB.put('kitchen', STATE.kitchenQueue[idx]);
  toast(`Order #${orderId} ready! 🎉`, 'success');
  renderView();
}

async function kitchenBump(orderId) {
  const idx = STATE.kitchenQueue.findIndex(k => k.orderId === orderId);
  if (idx < 0) return;
  STATE.kitchenQueue.splice(idx, 1);
  await DB.delete('kitchen', orderId);
  renderView();
}

// ── ORDERS VIEW ───────────────────────────────────────────────────────────────
function renderOrders(container) {
  const allDates = [...new Set(STATE.orders.map(o => o.date))].sort().reverse();
  const filtered = STATE.orders.filter(o =>
    (STATE.ordersDateFilter === 'all' || o.date === STATE.ordersDateFilter) &&
    (o.id.toString().includes(STATE.ordersSearch) ||
     (o.customerName || '').toLowerCase().includes(STATE.ordersSearch.toLowerCase()) ||
     o.items.some(i => i.name.toLowerCase().includes(STATE.ordersSearch.toLowerCase())))
  ).sort((a, b) => b.id - a.id);

  container.innerHTML = `
    <div id="orders-view">
      <div class="view-title">📋 Orders</div>
      <div class="filter-bar">
        <input class="search-orders" placeholder="🔍 Search order, customer…"
          value="${STATE.ordersSearch}" oninput="STATE.ordersSearch=this.value;renderView()"/>
        <button class="filter-chip ${STATE.ordersDateFilter===todayStr()?'active':''}"
          onclick="STATE.ordersDateFilter='${todayStr()}';renderView()">Today</button>
        ${allDates.filter(d => d !== todayStr()).slice(0,5).map(d =>
          `<button class="filter-chip ${STATE.ordersDateFilter===d?'active':''}"
            onclick="STATE.ordersDateFilter='${d}';renderView()">${dateLabel(d)}</button>`
        ).join('')}
        <button class="filter-chip ${STATE.ordersDateFilter==='all'?'active':''}"
          onclick="STATE.ordersDateFilter='all';renderView()">All</button>
      </div>
      ${filtered.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--muted)">No orders found</div>' : ''}
      ${filtered.map(o => `
        <div class="order-card" onclick="showOrderDetail(${o.id})">
          <div class="order-card-top">
            <span class="order-num">#${o.id}</span>
            <span class="order-meta">${o.date} ${o.time}${o.customerName?' · '+o.customerName:''}</span>
            <span class="order-pay-chip">${PAY_METHODS.find(p=>p.id===o.payMethod)?.label||o.payMethod}</span>
            <span class="order-status ${o.status==='voided'?'status-voided':'status-done'}">${o.status==='voided'?'Voided':'✓ Done'}</span>
            <span class="order-total">${peso(o.total)}</span>
          </div>
          <div class="order-items-preview">${o.items.map(i=>`${i.emoji} ${i.name}(${i.size})×${i.qty}`).join(' · ')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function showOrderDetail(orderId) {
  const o = STATE.orders.find(x => x.id === orderId);
  if (!o) return;
  showModal(`
    <div class="receipt-brand">
      <div class="logo">☕ ${STATE.settings.storeName}</div>
      <div class="sub">Order #${o.id} · ${o.date} ${o.time}</div>
      ${o.customerName ? `<div class="sub">Customer: ${o.customerName}</div>` : ''}
    </div>
    <hr class="modal-divider"/>
    ${o.items.map(i => `
      <div class="modal-item-row">
        <span>${i.emoji} ${i.name} (${SIZE_LABELS[i.size]}) ×${i.qty}${i.note?' · '+i.note:''}</span>
        <span>${peso(i.price*i.qty)}</span>
      </div>`).join('')}
    <hr class="modal-divider"/>
    <div class="modal-row"><span>Subtotal</span><span>${peso(o.subtotal)}</span></div>
    ${o.discount>0?`<div class="modal-row red"><span>Discount</span><span>-${peso(o.discount)}</span></div>`:''}
    <div class="modal-row big"><span>TOTAL</span><span>${peso(o.total)}</span></div>
    <div class="modal-row"><span>${PAY_METHODS.find(p=>p.id===o.payMethod)?.label||o.payMethod}</span><span>${peso(o.cashIn||o.total)}</span></div>
    ${o.payMethod==='cash'?`<div class="modal-row green"><span>Change</span><span>${peso(o.change||0)}</span></div>`:''}
    <div class="modal-btns">
      <button class="modal-btn danger" onclick="voidOrder(${o.id})">Void Order</button>
      <button class="modal-btn secondary" onclick="closeModal()">Close</button>
    </div>
  `);
}

async function voidOrder(orderId) {
  const o = STATE.orders.find(x => x.id === orderId);
  if (!o) return;
  o.status = 'voided';
  await DB.put('orders', o);
  closeModal();
  toast(`Order #${orderId} voided`, 'error');
  updateTopbar();
  renderView();
}

// ── INVENTORY VIEW ────────────────────────────────────────────────────────────
function renderInventory(container) {
  container.innerHTML = `
    <div id="inventory-view">
      <div class="view-title">📦 Inventory</div>
      <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
        <div class="stat-card" style="min-width:140px;">
          <div class="stat-icon">📦</div>
          <div class="stat-val" style="color:var(--blue)">${STATE.ingredients.length}</div>
          <div class="stat-lbl">Ingredients</div>
        </div>
        <div class="stat-card" style="min-width:140px;">
          <div class="stat-icon">⚠️</div>
          <div class="stat-val" style="color:#f5a623">${STATE.ingredients.filter(i=>i.stock>0&&i.stock<=i.reorder).length}</div>
          <div class="stat-lbl">Low Stock</div>
        </div>
        <div class="stat-card" style="min-width:140px;">
          <div class="stat-icon">🚫</div>
          <div class="stat-val" style="color:var(--red)">${STATE.ingredients.filter(i=>i.stock<=0).length}</div>
          <div class="stat-lbl">Out of Stock</div>
        </div>
        <div class="stat-card" style="min-width:140px;">
          <div class="stat-icon">💰</div>
          <div class="stat-val" style="color:var(--green);font-size:16px">${peso(STATE.ingredients.reduce((s,i)=>s+i.stock*i.costPer,0))}</div>
          <div class="stat-lbl">Total Value</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;">
        <div class="inv-tabs">
          ${['All','Dairy','Coffee','Dry','Syrup','Topping','Packaging'].map(t=>`
            <button class="inv-tab ${STATE.invTab===t?'active':''}" onclick="STATE.invTab='${t}';renderView()">${t}</button>
          `).join('')}
        </div>
        <button onclick="showAddIngredientModal()" style="margin-left:auto;background:var(--accent);color:#000;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;">+ Add</button>
      </div>
      <div class="inv-grid">
        ${STATE.ingredients.filter(i => STATE.invTab==='All' || i.cat===STATE.invTab).map(ing => {
          const pct = Math.min(100, (ing.stock / (ing.reorder * 3)) * 100);
          const statusClass = ing.stock <= 0 ? 'out' : ing.stock <= ing.reorder ? 'low' : '';
          const statusLabel = ing.stock <= 0 ? 'Out' : ing.stock <= ing.reorder ? 'Low' : 'OK';
          const statusCls = ing.stock <= 0 ? 'inv-out' : ing.stock <= ing.reorder ? 'inv-low' : 'inv-ok';
          const progCls = ing.stock <= 0 ? 'inv-prog-out' : ing.stock <= ing.reorder ? 'inv-prog-low' : 'inv-prog-ok';
          return `
          <div class="inv-card ${statusClass}">
            <div class="inv-card-top">
              <span class="inv-emoji">${getIngEmoji(ing.cat)}</span>
              <div style="flex:1">
                <div class="inv-name">${ing.name}</div>
                <div style="font-size:10px;color:var(--muted)">${ing.cat} · ${ing.supplier||''}</div>
              </div>
              <span class="inv-status ${statusCls}">${statusLabel}</span>
            </div>
            <div class="inv-stat-row"><span class="inv-stat-lbl">Stock</span><span class="inv-stat-val">${ing.stock.toLocaleString()} ${ing.unit}</span></div>
            <div class="inv-stat-row"><span class="inv-stat-lbl">Reorder at</span><span class="inv-stat-val">${ing.reorder} ${ing.unit}</span></div>
            <div class="inv-stat-row"><span class="inv-stat-lbl">Cost/unit</span><span class="inv-stat-val">${peso(ing.costPer)}</span></div>
            <div class="inv-stat-row"><span class="inv-stat-lbl">Total value</span><span class="inv-stat-val" style="color:var(--accent)">${peso(ing.stock*ing.costPer)}</span></div>
            <div class="inv-prog"><div class="inv-prog-fill ${progCls}" style="width:${pct}%"></div></div>
            <div style="display:flex;gap:6px;margin-top:10px;">
              <button class="inv-adjust-btn" style="flex:2" onclick="showAdjustModal(${ing.id})">📦 Adjust Stock</button>
              <button class="inv-adjust-btn" style="flex:1;border-color:var(--blue);color:var(--blue)" onclick="showEditIngredientModal(${ing.id})">✏️ Edit</button>
              <button class="inv-adjust-btn" style="flex:1;border-color:var(--red);color:var(--red)" onclick="confirmDeleteIngredient(${ing.id})">🗑️</button>
            </div>
          </div>
        `}).join('')}
      </div>
    </div>
  `;
}

function getIngEmoji(cat) {
  return {Dairy:'🥛',Coffee:'☕',Dry:'🌾',Syrup:'🍯',Topping:'🫙',Packaging:'📦'}[cat] || '📦';
}

function showAdjustModal(ingId) {
  const ing = STATE.ingredients.find(i => i.id === ingId);
  if (!ing) return;
  showModal(`
    <div class="modal-title">📦 Adjust Stock — ${ing.name}</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:14px">Current: <strong style="color:var(--text)">${ing.stock} ${ing.unit}</strong></div>
    <div class="modal-label">Action</div>
    <select class="modal-select" id="adj-action">
      <option value="add">Add Stock (Restock)</option>
      <option value="set">Set Exact Amount</option>
      <option value="remove">Remove / Waste</option>
    </select>
    <div class="modal-label">Amount (${ing.unit})</div>
    <input class="modal-inp" id="adj-amount" type="number" min="0" placeholder="0"/>
    <div class="modal-label">Note (optional)</div>
    <input class="modal-inp" id="adj-note" placeholder="e.g. Restocked from supplier"/>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" onclick="doAdjust(${ingId})">Save</button>
    </div>
  `);
}

async function doAdjust(ingId) {
  const action = $('adj-action').value;
  const amount = Number($('adj-amount').value);
  if (isNaN(amount) || amount < 0) return toast('Invalid amount', 'error');
  const ing = STATE.ingredients.find(i => i.id === ingId);
  if (!ing) return;
  if (action === 'add') ing.stock += amount;
  else if (action === 'set') ing.stock = amount;
  else if (action === 'remove') ing.stock = Math.max(0, ing.stock - amount);
  await DB.put('ingredients', ing);
  closeModal();
  toast(`${ing.name} stock updated → ${ing.stock} ${ing.unit}`);
  renderView();
}

function showAddIngredientModal() {
  showModal(`
    <div class="modal-title">+ Add Ingredient</div>
    <div class="modal-label">Name</div><input class="modal-inp" id="ni-name" placeholder="Ingredient name"/>
    <div class="modal-label">Category</div>
    <select class="modal-select" id="ni-cat">
      ${['Dairy','Coffee','Dry','Syrup','Topping','Packaging'].map(c=>`<option>${c}</option>`).join('')}
    </select>
    <div class="modal-label">Unit</div><input class="modal-inp" id="ni-unit" placeholder="g / ml / pcs"/>
    <div class="modal-label">Current Stock</div><input class="modal-inp" id="ni-stock" type="number" placeholder="0"/>
    <div class="modal-label">Cost per Unit (₱)</div><input class="modal-inp" id="ni-cost" type="number" placeholder="0.00"/>
    <div class="modal-label">Reorder Level</div><input class="modal-inp" id="ni-reorder" type="number" placeholder="100"/>
    <div class="modal-label">Supplier</div><input class="modal-inp" id="ni-supplier" placeholder="Supplier name"/>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" onclick="addIngredient()">Add</button>
    </div>
  `);
}

async function addIngredient() {
  const name = $('ni-name').value.trim();
  if (!name) return toast('Name required', 'error');
  const ing = {
    name, cat: $('ni-cat').value, unit: $('ni-unit').value || 'pcs',
    stock: Number($('ni-stock').value) || 0,
    costPer: Number($('ni-cost').value) || 0,
    reorder: Number($('ni-reorder').value) || 0,
    supplier: $('ni-supplier').value,
  };
  const id = await DB.add('ingredients', ing);
  ing.id = id;
  STATE.ingredients.push(ing);
  closeModal();
  toast(`${name} added to inventory!`);
  renderView();
}

// ── CUSTOMERS VIEW ────────────────────────────────────────────────────────────
function renderCustomers(container) {
  container.innerHTML = `
    <div id="customers-view">
      <div class="view-title">👥 Customers</div>
      <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;">
        <input class="search-orders" placeholder="🔍 Search name or phone…" id="cust-search-inp"
          oninput="renderCustomerCards(this.value)" style="flex:1;max-width:300px;"/>
        <button onclick="showAddCustomerModal()" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;">+ Add Customer</button>
        <div style="margin-left:auto;font-size:12px;color:var(--muted)">${STATE.customers.length} customers</div>
      </div>
      <div class="cust-grid" id="cust-cards-grid">
        ${renderCustomerGrid(STATE.customers)}
      </div>
    </div>
  `;
}

function renderCustomerCards(search) {
  const grid = $('cust-cards-grid');
  if (!grid) return;
  const filtered = STATE.customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );
  grid.innerHTML = renderCustomerGrid(filtered);
}

function renderCustomerGrid(custs) {
  if (custs.length === 0) return '<div style="color:var(--muted);padding:40px;text-align:center">No customers yet</div>';
  return custs.map(c => {
    const pts = c.loyaltyPoints || 0;
    const nextReward = STATE.settings.loyaltyRedeem * 100;
    const pct = Math.min(100, (pts / nextReward) * 100);
    const color = AVATAR_COLORS[c.id % AVATAR_COLORS.length];
    const custOrders = STATE.orders.filter(o => o.customerId === c.id && o.status !== 'voided');
    return `
      <div class="cust-card" onclick="showCustomerDetail(${c.id})">
        <div class="cust-card-top">
          <div class="cust-avatar" style="background:${color}">${c.name.slice(0,2).toUpperCase()}</div>
          <div>
            <div class="cust-cname">${c.name}</div>
            <div class="cust-phone">${c.phone || 'No phone'}</div>
          </div>
          <span class="loyalty-badge" style="margin-left:auto">★ ${pts}</span>
        </div>
        <div class="loyalty-bar"><div class="loyalty-fill" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:8px">
          <span>${pts} pts</span><span>${Math.round(pct)}% to reward</span>
        </div>
        <div class="cust-stats">
          <div class="cust-stat"><div class="cust-stat-val text-accent">${peso(c.totalSpent||0)}</div><div class="cust-stat-lbl">Total Spent</div></div>
          <div class="cust-stat"><div class="cust-stat-val text-blue">${c.visits||0}</div><div class="cust-stat-lbl">Visits</div></div>
          <div class="cust-stat"><div class="cust-stat-val text-green">${custOrders.length}</div><div class="cust-stat-lbl">Orders</div></div>
        </div>
      </div>
    `;
  }).join('');
}

function showCustomerDetail(custId) {
  const c = STATE.customers.find(x => x.id === custId);
  if (!c) return;
  const custOrders = STATE.orders.filter(o => o.customerId === custId && o.status !== 'voided').slice(-5).reverse();
  showModal(`
    <div class="modal-title">👤 ${c.name}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${c.phone||'No phone'} · Member since ${c.joinDate||'N/A'}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">
      <div class="stat-card" style="padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:var(--accent)">${c.loyaltyPoints||0}</div>
        <div style="font-size:10px;color:var(--muted)">Points</div>
      </div>
      <div class="stat-card" style="padding:10px;text-align:center">
        <div style="font-size:14px;font-weight:700;color:var(--green)">${peso(c.totalSpent||0)}</div>
        <div style="font-size:10px;color:var(--muted)">Total Spent</div>
      </div>
      <div class="stat-card" style="padding:10px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:var(--blue)">${c.visits||0}</div>
        <div style="font-size:10px;color:var(--muted)">Visits</div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--accent)">Recent Orders</div>
    ${custOrders.length === 0 ? '<div style="font-size:12px;color:var(--muted)">No orders yet</div>' :
      custOrders.map(o => `<div class="modal-item-row"><span>#${o.id} · ${o.date}</span><span style="color:var(--green)">${peso(o.total)}</span></div>`).join('')
    }
    <div style="margin-top:14px;display:flex;gap:8px">
      <input class="modal-inp" id="redeem-pts" type="number" min="0" max="${c.loyaltyPoints||0}" placeholder="Points to redeem" style="flex:1"/>
      <button class="modal-btn primary" onclick="redeemPoints(${custId})" style="flex:none;padding:8px 14px">Redeem</button>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:4px">${STATE.settings.loyaltyRedeem} pts = ₱1.00</div>
    <div class="modal-btns"><button class="modal-btn secondary" onclick="closeModal()">Close</button></div>
  `);
}

async function redeemPoints(custId) {
  const c = STATE.customers.find(x => x.id === custId);
  const pts = Number($('redeem-pts').value);
  if (!pts || pts > (c.loyaltyPoints||0)) return toast('Invalid points', 'error');
  const discount = pts / STATE.settings.loyaltyRedeem;
  c.loyaltyPoints -= pts;
  await DB.put('customers', c);
  const idx = STATE.customers.findIndex(x => x.id === custId);
  if (idx >= 0) STATE.customers[idx] = { ...c };
  closeModal();
  toast(`Redeemed ${pts} pts = ${peso(discount)} discount!`, 'success');
  renderView();
}

// ── SUMMARY VIEW ──────────────────────────────────────────────────────────────
function renderSummary(container) {
  const todayOrders = STATE.orders.filter(o => o.date === todayStr() && o.status !== 'voided');
  const sales = todayOrders.reduce((s, o) => s + o.total, 0);
  const count = todayOrders.length;
  const avg = count ? sales / count : 0;
  const items = todayOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0);

  // Top products
  const tally = {};
  todayOrders.forEach(o => o.items.forEach(i => { tally[i.name] = (tally[i.name]||0) + i.qty; }));
  const topProds = Object.entries(tally).sort((a,b) => b[1]-a[1]).slice(0,8);
  const maxQty = topProds[0]?.[1] || 1;

  // Hourly
  const hourly = Array(24).fill(0);
  todayOrders.forEach(o => {
    const h = parseInt(o.time.split(':')[0]);
    if (!isNaN(h)) hourly[h] += o.total;
  });
  const peakHours = hourly.slice(6,22);
  const maxH = Math.max(...peakHours, 1);

  // Payment breakdown
  const payBreak = {};
  todayOrders.forEach(o => { payBreak[o.payMethod] = (payBreak[o.payMethod]||0) + o.total; });

  container.innerHTML = `
    <div id="summary-view">
      <div class="view-title">📊 Daily Summary — ${dateLabel(todayStr())}</div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-val" style="color:var(--green)">${peso(sales)}</div><div class="stat-lbl">Total Sales</div></div>
        <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-val" style="color:var(--blue)">${count}</div><div class="stat-lbl">Orders</div></div>
        <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-val" style="color:var(--accent)">${peso(avg)}</div><div class="stat-lbl">Avg Order</div></div>
        <div class="stat-card"><div class="stat-icon">🧋</div><div class="stat-val" style="color:var(--purple)">${items}</div><div class="stat-lbl">Items Sold</div></div>
      </div>

      <div class="hourly-chart">
        <div class="section-title">⏰ Hourly Sales (6am–10pm)</div>
        <div class="hourly-bars">
          ${peakHours.map((v,i) => `
            <div class="h-bar-wrap">
              <div class="h-bar" style="height:${Math.round((v/maxH)*60)+2}px;opacity:${v>0?1:0.2}"></div>
              <div class="h-lbl">${6+i}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="section-title">💳 Payment Methods</div>
      <div class="pay-summary-grid">
        ${PAY_METHODS.map(pm => {
          const v = payBreak[pm.id] || 0;
          if (v === 0) return '';
          return `<div class="pay-sum-card"><div class="pay-sum-icon">${pm.icon}</div><div class="pay-sum-val">${peso(v)}</div><div class="pay-sum-lbl">${pm.label}</div></div>`;
        }).join('')}
        ${Object.keys(payBreak).length === 0 ? '<div style="color:var(--muted);font-size:12px">No sales yet today</div>' : ''}
      </div>

      <div class="section-title">🏆 Top Products Today</div>
      ${topProds.map(([name, qty]) => {
        const prod = STATE.products.find(p => p.name === name);
        return `
          <div class="top-product-row">
            <span class="tp-emoji">${prod?.emoji||'🧋'}</span>
            <span class="tp-name">${name}</span>
            <div class="tp-bar-wrap"><div class="tp-bar" style="width:${Math.round((qty/maxQty)*100)}%;background:${prod?.color||'var(--accent)'}"></div></div>
            <span class="tp-qty">${qty}</span>
          </div>`;
      }).join('')}
      ${topProds.length === 0 ? '<div style="color:var(--muted);font-size:12px;padding:10px 0">No sales yet — start selling! 🚀</div>' : ''}
    </div>
  `;
}

// ── SETTINGS VIEW ─────────────────────────────────────────────────────────────
function renderSettings(container) {
  const s = STATE.settings;
  container.innerHTML = `
    <div id="settings-view">
      <div class="view-title">⚙️ Settings</div>

      <div class="settings-section">
        <div class="settings-title">🏪 Store Info</div>
        <div class="setting-row"><div><div class="setting-lbl">Store Name</div></div>
          <input class="setting-inp" id="s-name" value="${s.storeName}"/></div>
        <div class="setting-row"><div><div class="setting-lbl">Address</div></div>
          <input class="setting-inp" id="s-addr" value="${s.storeAddress}"/></div>
      </div>

      <div class="settings-section">
        <div class="settings-title">📱 GCash / Maya</div>
        <div class="setting-row"><div><div class="setting-lbl">GCash/Maya Number</div></div>
          <input class="setting-inp" id="s-gcash" value="${s.gcashNumber}"/></div>
        <div class="setting-row"><div><div class="setting-lbl">Account Name</div></div>
          <input class="setting-inp" id="s-gcash-name" value="${s.gcashName}"/></div>
      </div>

      <div class="settings-section">
        <div class="settings-title">🏧 Bank Transfer</div>
        <div class="setting-row"><div><div class="setting-lbl">Bank Name</div></div>
          <input class="setting-inp" id="s-bank" value="${s.bankName}"/></div>
        <div class="setting-row"><div><div class="setting-lbl">Account Number</div></div>
          <input class="setting-inp" id="s-bank-acc" value="${s.bankAccount}"/></div>
        <div class="setting-row"><div><div class="setting-lbl">Account Name</div></div>
          <input class="setting-inp" id="s-bank-name" value="${s.bankAccountName}"/></div>
      </div>

      <div class="settings-section">
        <div class="settings-title">⭐ Loyalty Points</div>
        <div class="setting-row">
          <div><div class="setting-lbl">Points per ₱1 spent</div><div class="setting-sub">e.g. 1 = earn 1pt per peso</div></div>
          <input class="setting-inp" id="s-loy-rate" type="number" value="${s.loyaltyRate}" style="width:80px"/>
        </div>
        <div class="setting-row">
          <div><div class="setting-lbl">Points = ₱1</div><div class="setting-sub">e.g. 100 pts = ₱1 discount</div></div>
          <input class="setting-inp" id="s-loy-redeem" type="number" value="${s.loyaltyRedeem}" style="width:80px"/>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">⚙️ POS Options</div>
        <div class="setting-row">
          <div><div class="setting-lbl">Auto-deduct inventory on sale</div></div>
          <div class="toggle ${s.autoDeductStock?'on':''}" id="toggle-stock" onclick="toggleSetting('autoDeductStock')">
            <div class="toggle-knob"></div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-title">🔒 PIN Security</div>
        <div class="setting-row">
          <div>
            <div class="setting-lbl">Enable PIN Lock</div>
            <div class="setting-sub">Locks Inventory, Products, Customers, Summary & Settings</div>
          </div>
          <div class="toggle ${s.pinEnabled?'on':''}" id="toggle-pin" onclick="togglePinEnabled()">
            <div class="toggle-knob"></div>
          </div>
        </div>
        <div class="setting-row" id="pin-setup-row" style="${s.pinEnabled?'':'opacity:.4;pointer-events:none;'}">
          <div><div class="setting-lbl">Admin PIN</div><div class="setting-sub">4–6 digits</div></div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input class="setting-inp" id="s-pin" type="password" inputmode="numeric"
              maxlength="6" placeholder="••••" value="${s.adminPin||''}" style="width:100px;letter-spacing:4px;font-size:18px;text-align:center;"/>
            <button onclick="togglePinVisibility()" style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--muted);cursor:pointer;font-size:13px;">👁️</button>
          </div>
        </div>
        ${s.pinEnabled && s.adminPin ? `
        <div style="margin-top:8px;padding:10px 12px;background:rgba(46,204,122,.07);border-radius:8px;border:1px solid rgba(46,204,122,.2);font-size:12px;color:var(--green);">
          ✅ PIN is active — staff can only access POS, Kitchen & Orders
        </div>` : s.pinEnabled ? `
        <div style="margin-top:8px;padding:10px 12px;background:rgba(245,166,35,.07);border-radius:8px;border:1px solid rgba(245,166,35,.2);font-size:12px;color:var(--accent);">
          ⚠️ Enter a PIN above and save to activate lock
        </div>` : ''}
      </div>

      <div style="display:flex;gap:10px;margin-top:8px;">
        <button class="btn-save" onclick="saveSettings()">💾 Save Settings</button>
        <button class="btn-danger" onclick="confirmClearData()">🗑️ Clear All Data</button>
      </div>
    </div>
  `;
}

function toggleSetting(key) {
  STATE.settings[key] = !STATE.settings[key];
  const el1 = $(`toggle-${key.replace('autoDeductStock','stock')}`);
  if (el1) el1.className = `toggle ${STATE.settings[key]?'on':''}`;
}

function togglePinEnabled() {
  STATE.settings.pinEnabled = !STATE.settings.pinEnabled;
  const tog = $('toggle-pin');
  if (tog) tog.className = `toggle ${STATE.settings.pinEnabled?'on':''}`;
  const row = $('pin-setup-row');
  if (row) row.style.cssText = STATE.settings.pinEnabled ? '' : 'opacity:.4;pointer-events:none;';
}

function togglePinVisibility() {
  const inp = $('s-pin');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function saveSettings() {
  STATE.settings.storeName = $('s-name').value;
  STATE.settings.storeAddress = $('s-addr').value;
  STATE.settings.gcashNumber = $('s-gcash').value;
  STATE.settings.gcashName = $('s-gcash-name').value;
  STATE.settings.bankName = $('s-bank').value;
  STATE.settings.bankAccount = $('s-bank-acc').value;
  STATE.settings.bankAccountName = $('s-bank-name').value;
  STATE.settings.loyaltyRate = Number($('s-loy-rate').value) || 1;
  STATE.settings.loyaltyRedeem = Number($('s-loy-redeem').value) || 100;
  // PIN
  const pinVal = ($('s-pin') ? $('s-pin').value.trim() : STATE.settings.adminPin);
  if (pinVal && !/^\d{4,6}$/.test(pinVal)) return toast('PIN must be 4–6 digits', 'error');
  STATE.settings.adminPin = pinVal;
  if (!pinVal) STATE.settings.pinEnabled = false;
  for (const [k, v] of Object.entries(STATE.settings)) {
    await DB.setSetting(k, v);
  }
  toast('Settings saved! ✓', 'success');
  const logo = qs('.tb-logo');
  if (logo) logo.textContent = '☕ ' + STATE.settings.storeName;
}

function confirmClearData() {
  showModal(`
    <div class="modal-title" style="color:var(--red)">⚠️ Clear All Data</div>
    <div style="font-size:13px;margin-bottom:16px">This will delete ALL orders, customers, and inventory data. This cannot be undone!</div>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn danger" onclick="clearAllData()">Yes, Delete Everything</button>
    </div>
  `);
}

async function clearAllData() {
  await DB.open();
  const stores = ['orders', 'customers', 'kitchen'];
  for (const store of stores) {
    const all = await DB.getAll(store);
    for (const item of all) await DB.delete(store, item.id || item.orderId);
  }
  STATE.orders = [];
  STATE.customers = [];
  STATE.kitchenQueue = [];
  orderSeq = 1001;
  closeModal();
  toast('All data cleared', 'error');
  updateTopbar();
  renderView();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function todaySales() {
  return STATE.orders
    .filter(o => o.date === todayStr() && o.status !== 'voided')
    .reduce((s, o) => s + o.total, 0);
}

// ── Expose to global scope for onclick handlers ───────────────────────────────
Object.assign(window, {
  setView, onSearch, setCat, setSize, setPayMethod, setCashIn,
  addToCart, removeFromCart, changeQty, clearCart,
  addItemNote, saveItemNote,
  onCustSearch, lookupCustomer, addNewCustomer, showAddCustomerModal,
  checkout, showReceiptModal, voidOrder, showOrderDetail,
  kitchenDone, kitchenBump, toggleKitchenItem,
  showAdjustModal, doAdjust, addIngredient, showAddIngredientModal,
  showEditIngredientModal, saveEditIngredient, confirmDeleteIngredient, deleteIngredient,
  renderProductsMgmt, showAddProductModal, saveNewProduct,
  showEditProductModal, saveEditProduct, toggleProductActive,
  confirmDeleteProduct, deleteProduct, selectEmoji, selectColor,
  showCustomerDetail, redeemPoints, renderCustomerCards,
  saveSettings, toggleSetting, togglePinEnabled, togglePinVisibility,
  pinKey, lockApp, showPinModal,
  confirmClearData, clearAllData,
  closeModal,
});

// ── Start ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);

// ── EDIT / DELETE INGREDIENT ──────────────────────────────────────────────────
function showEditIngredientModal(ingId) {
  const ing = STATE.ingredients.find(i => i.id === ingId);
  if (!ing) return;
  showModal(`
    <div class="modal-title">✏️ Edit Ingredient — ${ing.name}</div>
    <div class="modal-label">Name</div>
    <input class="modal-inp" id="ei-name" value="${ing.name}"/>
    <div class="modal-label">Category</div>
    <select class="modal-select" id="ei-cat">
      ${['Dairy','Coffee','Dry','Syrup','Topping','Packaging'].map(c=>`<option ${ing.cat===c?'selected':''}>${c}</option>`).join('')}
    </select>
    <div class="modal-label">Unit (g / ml / pcs / roll…)</div>
    <input class="modal-inp" id="ei-unit" value="${ing.unit}"/>
    <div class="modal-label">Cost per Unit (₱)</div>
    <input class="modal-inp" id="ei-cost" type="number" step="0.001" value="${ing.costPer}"/>
    <div class="modal-label">Reorder Level</div>
    <input class="modal-inp" id="ei-reorder" type="number" value="${ing.reorder}"/>
    <div class="modal-label">Supplier</div>
    <input class="modal-inp" id="ei-supplier" value="${ing.supplier||''}"/>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" onclick="saveEditIngredient(${ingId})">💾 Save Changes</button>
    </div>
  `);
}

async function saveEditIngredient(ingId) {
  const ing = STATE.ingredients.find(i => i.id === ingId);
  if (!ing) return;
  ing.name     = document.getElementById('ei-name').value.trim() || ing.name;
  ing.cat      = document.getElementById('ei-cat').value;
  ing.unit     = document.getElementById('ei-unit').value.trim() || ing.unit;
  ing.costPer  = Number(document.getElementById('ei-cost').value) || 0;
  ing.reorder  = Number(document.getElementById('ei-reorder').value) || 0;
  ing.supplier = document.getElementById('ei-supplier').value;
  await DB.put('ingredients', ing);
  const idx = STATE.ingredients.findIndex(i => i.id === ingId);
  if (idx >= 0) STATE.ingredients[idx] = { ...ing };
  closeModal();
  toast(`${ing.name} updated ✓`);
  renderView();
}

function confirmDeleteIngredient(ingId) {
  const ing = STATE.ingredients.find(i => i.id === ingId);
  if (!ing) return;
  showModal(`
    <div class="modal-title" style="color:var(--red)">🗑️ Delete Ingredient?</div>
    <div style="font-size:13px;margin-bottom:16px">Delete <strong>${ing.name}</strong>? This cannot be undone.</div>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn danger" onclick="deleteIngredient(${ingId})">Yes, Delete</button>
    </div>
  `);
}

async function deleteIngredient(ingId) {
  await DB.delete('ingredients', ingId);
  STATE.ingredients = STATE.ingredients.filter(i => i.id !== ingId);
  closeModal();
  toast('Ingredient deleted', 'error');
  renderView();
}

// ── PRODUCTS MANAGEMENT VIEW ──────────────────────────────────────────────────
const EMOJI_OPTIONS = ['🧋','🐯','🫐','🍵','🍃','🍫','🍮','🍓','☕','🍦','🥛','🥭','🍹','🧃','🥤','🍰','🍩','🍪','⚫','🥥','💎','🫧','🍑','🍇','🍈','🍋','🥝','🧁'];
const COLOR_OPTIONS = ['#f5a623','#e94560','#27c96e','#4ea8de','#a78bfa','#f472b6','#fb923c','#c8841a','#b5651d','#8B4513','#D2691E','#27AE60','#2980B9','#8E44AD'];

function renderProductsMgmt(container) {
  const allCats = ['All', ...new Set(STATE.products.map(p => p.cat))];
  const filtered = STATE.products.filter(p => STATE.cat === 'All' || p.cat === STATE.cat);
  container.innerHTML = `
    <div id="products-view">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
        <div class="view-title" style="margin:0">🍹 Products (${STATE.products.length})</div>
        <button onclick="showAddProductModal()" style="background:var(--accent);color:#000;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer;">+ Add Product</button>
      </div>
      <div style="display:flex;gap:7px;overflow-x:auto;margin-bottom:14px;padding-bottom:4px;">
        ${allCats.map(c => `<button class="cat-chip ${STATE.cat===c?'active':''}" onclick="STATE.cat='${c}';renderView()">${c}</button>`).join('')}
      </div>
      <div class="mgmt-grid">
        ${filtered.map(p => `
          <div class="mgmt-card" style="border-top:3px solid ${p.color||'var(--accent)'};">
            <div class="mgmt-card-top">
              <span class="mgmt-emoji-big">${p.emoji}</span>
              <div style="flex:1;min-width:0;">
                <div class="mgmt-name">${p.name}</div>
                <div class="mgmt-cat">${p.cat}</div>
              </div>
              <span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;flex-shrink:0;${p.active===false?'background:rgba(233,69,96,.1);color:var(--red)':'background:rgba(46,204,122,.1);color:var(--green)'}">
                ${p.active===false?'Hidden':'Active'}
              </span>
            </div>
            <div class="price-grid">
              ${SIZES.map(s => `
                <div class="price-cell">
                  <span class="price-cell-sz">${s}</span>
                  <span class="price-cell-val">${peso(p.prices[s]||0)}</span>
                </div>`).join('')}
            </div>
            <div style="display:flex;gap:5px;margin-top:8px;">
              <button class="inv-adjust-btn" style="flex:2;border-color:var(--blue);color:var(--blue)" onclick="showEditProductModal(${p.id})">✏️ Edit</button>
              <button class="inv-adjust-btn" style="flex:1;${p.active===false?'border-color:var(--green);color:var(--green)':'border-color:var(--muted);color:var(--muted)'}" onclick="toggleProductActive(${p.id})">${p.active===false?'Show':'Hide'}</button>
              <button class="inv-adjust-btn" style="flex:1;border-color:var(--red);color:var(--red)" onclick="confirmDeleteProduct(${p.id})">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function selectEmoji(e) {
  const inp = document.getElementById('np-emoji') || document.getElementById('ep-emoji');
  if (inp) inp.value = e;
  document.querySelectorAll('.emoji-opt').forEach(b => b.style.borderColor = 'var(--border)');
  if (event && event.target) event.target.style.borderColor = 'var(--accent)';
}
function selectColor(c) {
  const inp = document.getElementById('np-color') || document.getElementById('ep-color');
  if (inp) inp.value = c;
  document.querySelectorAll('.color-opt').forEach(b => b.style.borderColor = 'transparent');
  if (event && event.target) event.target.style.borderColor = '#fff';
}

function showAddProductModal() {
  showModal(`
    <div class="modal-title">+ Add Product</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <div class="modal-label">Product Name *</div>
        <input class="modal-inp" id="np-name" placeholder="e.g. Okinawa Milk Tea"/>
      </div>
      <div>
        <div class="modal-label">Category *</div>
        <input class="modal-inp" id="np-cat" placeholder="Milk Tea / Coffee…" list="cat-list"/>
        <datalist id="cat-list">
          ${[...new Set(STATE.products.map(p=>p.cat))].map(c=>`<option value="${c}">`).join('')}
        </datalist>
      </div>
    </div>
    <div class="modal-label">Emoji (tap one)</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;max-height:72px;overflow-y:auto;">
      ${EMOJI_OPTIONS.map(e=>`<button onclick="selectEmoji('${e}')" style="font-size:18px;background:var(--card);border:1.5px solid var(--border);border-radius:7px;padding:3px 7px;cursor:pointer;" class="emoji-opt">${e}</button>`).join('')}
    </div>
    <input class="modal-inp" id="np-emoji" placeholder="Emoji" value="🧋" style="width:80px;text-align:center;font-size:20px;margin-bottom:8px;"/>
    <div class="modal-label">Color (tap one)</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
      ${COLOR_OPTIONS.map(c=>`<button onclick="selectColor('${c}')" style="width:24px;height:24px;border-radius:50%;background:${c};border:2px solid transparent;cursor:pointer;" class="color-opt" data-color="${c}"></button>`).join('')}
    </div>
    <input class="modal-inp" id="np-color" value="#f5a623" placeholder="#hex color" style="width:110px;margin-bottom:8px;"/>
    <div class="modal-label">Prices per Size (₱)</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;">
      ${SIZES.map(s=>`<div><div style="font-size:10px;color:var(--muted);margin-bottom:2px">${s} – ${SIZE_LABELS[s]}</div><input class="modal-inp" id="np-price-${s}" type="number" placeholder="0" style="margin:0"/></div>`).join('')}
    </div>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" onclick="saveNewProduct()">Add Product</button>
    </div>
  `);
}

async function saveNewProduct() {
  const name = document.getElementById('np-name').value.trim();
  if (!name) return toast('Product name required', 'error');
  const prices = {};
  SIZES.forEach(s => { prices[s] = Number(document.getElementById('np-price-' + s).value) || 0; });
  const allIds = STATE.products.map(p => p.id);
  const prod = {
    id: allIds.length > 0 ? Math.max(...allIds) + 1 : 100,
    name,
    cat: document.getElementById('np-cat').value.trim() || 'Other',
    emoji: document.getElementById('np-emoji').value || '🧋',
    color: document.getElementById('np-color').value || '#f5a623',
    prices,
    active: true,
    recipe: [],
  };
  await DB.put('products', prod);
  STATE.products.push(prod);
  closeModal();
  toast(prod.emoji + ' ' + prod.name + ' added!');
  renderView();
}

function showEditProductModal(prodId) {
  const p = STATE.products.find(x => x.id === prodId);
  if (!p) return;
  showModal(`
    <div class="modal-title">✏️ Edit — ${p.emoji} ${p.name}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>
        <div class="modal-label">Product Name</div>
        <input class="modal-inp" id="ep-name" value="${p.name}"/>
      </div>
      <div>
        <div class="modal-label">Category</div>
        <input class="modal-inp" id="ep-cat" value="${p.cat}" list="ecat-list"/>
        <datalist id="ecat-list">
          ${[...new Set(STATE.products.map(x=>x.cat))].map(c=>`<option value="${c}">`).join('')}
        </datalist>
      </div>
    </div>
    <div class="modal-label">Emoji (tap one)</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px;max-height:72px;overflow-y:auto;">
      ${EMOJI_OPTIONS.map(e=>`<button onclick="selectEmoji('${e}')" style="font-size:18px;background:var(--card);border:1.5px solid ${e===p.emoji?'var(--accent)':'var(--border)'};border-radius:7px;padding:3px 7px;cursor:pointer;" class="emoji-opt">${e}</button>`).join('')}
    </div>
    <input class="modal-inp" id="ep-emoji" value="${p.emoji}" style="width:80px;text-align:center;font-size:20px;margin-bottom:8px;"/>
    <div class="modal-label">Color</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
      ${COLOR_OPTIONS.map(c=>`<button onclick="selectColor('${c}')" style="width:24px;height:24px;border-radius:50%;background:${c};border:2px solid ${c===p.color?'#fff':'transparent'};cursor:pointer;" class="color-opt" data-color="${c}"></button>`).join('')}
    </div>
    <input class="modal-inp" id="ep-color" value="${p.color||'#f5a623'}" placeholder="#hex" style="width:110px;margin-bottom:8px;"/>
    <div class="modal-label">Prices per Size (₱)</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;">
      ${SIZES.map(s=>`<div><div style="font-size:10px;color:var(--muted);margin-bottom:2px">${s} – ${SIZE_LABELS[s]}</div><input class="modal-inp" id="ep-price-${s}" type="number" value="${p.prices[s]||0}" style="margin:0"/></div>`).join('')}
    </div>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn primary" onclick="saveEditProduct(${prodId})">💾 Save Changes</button>
    </div>
  `);
}

async function saveEditProduct(prodId) {
  const p = STATE.products.find(x => x.id === prodId);
  if (!p) return;
  p.name  = document.getElementById('ep-name').value.trim() || p.name;
  p.cat   = document.getElementById('ep-cat').value.trim() || p.cat;
  p.emoji = document.getElementById('ep-emoji').value || p.emoji;
  p.color = document.getElementById('ep-color').value || p.color;
  SIZES.forEach(s => { p.prices[s] = Number(document.getElementById('ep-price-' + s).value) || 0; });
  await DB.put('products', p);
  const idx = STATE.products.findIndex(x => x.id === prodId);
  if (idx >= 0) STATE.products[idx] = { ...p };
  closeModal();
  toast(p.emoji + ' ' + p.name + ' updated ✓');
  renderView();
}

async function toggleProductActive(prodId) {
  const p = STATE.products.find(x => x.id === prodId);
  if (!p) return;
  p.active = (p.active === false) ? true : false;
  await DB.put('products', p);
  const idx = STATE.products.findIndex(x => x.id === prodId);
  if (idx >= 0) STATE.products[idx] = { ...p };
  toast(p.name + (p.active ? ' shown ✓' : ' hidden'));
  renderView();
}

function confirmDeleteProduct(prodId) {
  const p = STATE.products.find(x => x.id === prodId);
  if (!p) return;
  showModal(`
    <div class="modal-title" style="color:var(--red)">🗑️ Delete Product?</div>
    <div style="font-size:13px;margin-bottom:16px">Delete <strong>${p.emoji} ${p.name}</strong>? This cannot be undone.</div>
    <div class="modal-btns">
      <button class="modal-btn secondary" onclick="closeModal()">Cancel</button>
      <button class="modal-btn danger" onclick="deleteProduct(${prodId})">Yes, Delete</button>
    </div>
  `);
}

async function deleteProduct(prodId) {
  await DB.delete('products', prodId);
  STATE.products = STATE.products.filter(p => p.id !== prodId);
  closeModal();
  toast('Product deleted', 'error');
  renderView();
}
