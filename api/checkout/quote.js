// POST { items: [{ sku, qty }], country? } → authoritative price quote.
// Never trusts client-supplied prices — every amount comes from catalog.json.
const { priceFor, shippingFor } = require('../_lib/catalog');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { items, country } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items' });

    const lines = [];
    for (const it of items) {
      const p = priceFor(it.sku);
      if (!p) return res.status(400).json({ error: `Unknown SKU: ${it.sku}` });
      const qty = Math.max(1, Number(it.qty) || 1);
      lines.push({ sku: p.sku, name: p.name, price: p.price, qty, lineTotal: p.price * qty, image: p.image });
    }
    const subtotal = lines.reduce((n, l) => n + l.lineTotal, 0);
    const shipping = shippingFor(subtotal, country);
    if (shipping.amount == null) return res.status(200).json({ lines, subtotal, shippingAvailable: false, note: shipping.note });

    res.status(200).json({ lines, subtotal, shipping: shipping.amount, total: subtotal + shipping.amount, shippingAvailable: true, currency: 'INR' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
