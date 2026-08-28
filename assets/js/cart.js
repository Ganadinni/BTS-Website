// BTS cart — localStorage cart + drawer, shared by every page.
// Checkout re-derives price/qty server-side from assets/data/catalog.json by
// SKU; this file only stores {sku, qty} plus enough display data to render
// the drawer without a second fetch.
(function () {
  var KEY = 'btsCart';

  function readCart() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function writeCart(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
    renderCart();
  }
  function addToCart(item, qty) {
    qty = qty || 1;
    var items = readCart();
    var existing = items.find(function (i) { return i.sku === item.sku; });
    if (existing) { existing.qty += qty; }
    else { items.push({ sku: item.sku, name: item.name, price: item.price, image: item.image, qty: qty }); }
    writeCart(items);
    openCart();
  }
  function setQty(sku, qty) {
    var items = readCart();
    if (qty <= 0) { items = items.filter(function (i) { return i.sku !== sku; }); }
    else { var it = items.find(function (i) { return i.sku === sku; }); if (it) it.qty = qty; }
    writeCart(items);
  }
  function removeFromCart(sku) { setQty(sku, 0); }

  function money(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

  function renderCart() {
    var items = readCart();
    var count = items.reduce(function (n, i) { return n + i.qty; }, 0);
    var subtotal = items.reduce(function (n, i) { return n + i.qty * i.price; }, 0);
    var countEl = document.getElementById('cart-count');
    if (countEl) countEl.textContent = String(count);
    var subEl = document.getElementById('cart-subtotal');
    if (subEl) subEl.textContent = money(subtotal);
    var itemsEl = document.getElementById('cart-items');
    if (!itemsEl) return;
    if (items.length === 0) {
      itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty. Pick a flavour →</div>';
      return;
    }
    itemsEl.innerHTML = items.map(function (i) {
      return '<div class="cart-line">' +
        '<img src="' + i.image + '&width=120" alt="">' +
        '<div><div class="name">' + i.name + '</div>' +
        '<div class="row2">' +
          '<button data-sku="' + i.sku + '" data-delta="-1" class="qty-dec">&minus;</button>' +
          '<span>' + i.qty + '</span>' +
          '<button data-sku="' + i.sku + '" data-delta="1" class="qty-inc">+</button>' +
          '<button data-sku="' + i.sku + '" class="remove">remove</button>' +
        '</div></div>' +
        '<div class="price-num">' + money(i.qty * i.price) + '</div>' +
      '</div>';
    }).join('');
    itemsEl.querySelectorAll('.qty-dec,.qty-inc').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var items = readCart();
        var it = items.find(function (i) { return i.sku === btn.dataset.sku; });
        if (it) setQty(it.sku, it.qty + Number(btn.dataset.delta));
      });
    });
    itemsEl.querySelectorAll('.remove').forEach(function (btn) {
      btn.addEventListener('click', function () { removeFromCart(btn.dataset.sku); });
    });
  }

  function openCart() {
    var d = document.getElementById('cart-drawer'), o = document.getElementById('cart-overlay');
    if (d) d.classList.add('open');
    if (o) o.classList.add('open');
  }
  function closeCart() {
    var d = document.getElementById('cart-drawer'), o = document.getElementById('cart-overlay');
    if (d) d.classList.remove('open');
    if (o) o.classList.remove('open');
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderCart();
    var openBtn = document.getElementById('cart-open');
    var closeBtn = document.getElementById('cart-close');
    var overlay = document.getElementById('cart-overlay');
    if (openBtn) openBtn.addEventListener('click', openCart);
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (overlay) overlay.addEventListener('click', closeCart);
  });

  window.btsCart = { add: addToCart, setQty: setQty, remove: removeFromCart, read: readCart, render: renderCart, open: openCart };
})();
