// POST { items, customer:{name,email,phone}, address:{...} }
// → mints an order name, opens a Razorpay order, stores a pending row.
// Order numbers are minted HERE (checkout-open), not on payment — an
// abandoned checkout burns a number, same rule as theteaplanet.com's own
// checkout (dhanveer-core CLAUDE.md). Never "fix" the resulting gaps.
const { priceFor, shippingFor } = require('../_lib/catalog');
const { getPool, ensureSchema, nextOrderName } = require('../_lib/db');
const razorpay = require('../_lib/razorpay');
const { recordOrderLead } = require('../_lib/dhanveerBridge');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    if (!razorpay.configured()) return res.status(503).json({ error: 'Payments are not configured yet — RAZORPAY_KEY_ID/SECRET are unset.' });
    const pool = getPool();
    if (!pool) return res.status(503).json({ error: 'Order storage is not configured yet — DATABASE_URL is unset.' });
    await ensureSchema();

    const { items, customer, address } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items' });
    if (!customer?.name || !customer?.phone) return res.status(400).json({ error: 'Name and phone are required' });

    const lines = [];
    for (const it of items) {
      const p = priceFor(it.sku);
      if (!p) return res.status(400).json({ error: `Unknown SKU: ${it.sku}` });
      const qty = Math.max(1, Number(it.qty) || 1);
      lines.push({ sku: p.sku, name: p.name, price: p.price, qty, hsn: p.hsn });
    }
    const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
    const shipping = shippingFor(subtotal, address?.country || 'IN');
    if (shipping.amount == null) return res.status(400).json({ error: shipping.note });
    const total = subtotal + shipping.amount;

    const orderName = await nextOrderName();
    const rzpOrder = await razorpay.createOrder({
      amountPaise: Math.round(total * 100),
      receipt: orderName,
      notes: { order_name: orderName, source: 'bts-website' },
    });

    await pool.query(
      `INSERT INTO bts.orders (order_name, status, customer_name, email, phone, address, items, subtotal, shipping, total, razorpay_order_id)
       VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [orderName, customer.name, customer.email || null, customer.phone, JSON.stringify(address || {}), JSON.stringify(lines), subtotal, shipping.amount, total, rzpOrder.id]
    );

    res.status(200).json({
      orderName,
      razorpayOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      subtotal, shipping: shipping.amount, total,
    });

    // Best-effort, never blocks the buyer: mirror the order to Dhanveer the
    // moment checkout opens, not only on payment. A cart abandoned right
    // here is exactly the case this closes — previously the order sat in
    // bts.orders as 'pending' with nothing visible to Sales unless it later
    // paid. If it does pay, verify.js calls recordOrderLead again (default
    // 'paid' stage), which appends a second note to the SAME lead (dedup by
    // phone/email happens on dhanveer-core's side) rather than creating a
    // duplicate — so Sales sees "started checkout" then "paid" on one row.
    try {
      const leadId = await recordOrderLead({
        customer: { name: customer.name, email: customer.email, phone: customer.phone },
        orderName,
        items: lines,
        total,
        stage: 'cart',
      });
      if (leadId) await pool.query(`UPDATE bts.orders SET dhanveer_lead_id = $2 WHERE order_name = $1`, [orderName, leadId]);
    } catch (e) {
      console.error('[checkout/create-order] Dhanveer bridge failed for', orderName, ':', e?.message || e);
    }
  } catch (e) {
    console.error('[checkout/create-order]', e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};
