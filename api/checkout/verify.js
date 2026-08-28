// POST { orderName, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Payment truth is Razorpay's HMAC signature, verified server-side — an
// order only becomes PAID when it checks out. On success: mark paid, then
// best-effort (never blocking the customer's success response) raise the
// Zoho GFF invoice and mirror the order into Dhanveer's CRM.
const { getPool } = require('../_lib/db');
const razorpay = require('../_lib/razorpay');
const zoho = require('../_lib/zoho');
const { recordOrderLead } = require('../_lib/dhanveerBridge');
const { catalog } = require('../_lib/catalog');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { orderName, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!orderName || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing verification fields' });
    }
    const ok = razorpay.verifySignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature });
    if (!ok) return res.status(400).json({ error: 'Signature verification failed' });

    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM bts.orders WHERE order_name = $1`, [orderName]);
    const order = rows[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.razorpay_order_id !== razorpay_order_id) return res.status(400).json({ error: 'Order/payment mismatch' });

    if (order.status !== 'paid') {
      await pool.query(
        `UPDATE bts.orders SET status = 'paid', razorpay_payment_id = $2, paid_at = now() WHERE order_name = $1`,
        [orderName, razorpay_payment_id]
      );
    }

    res.status(200).json({ ok: true, orderName });

    // Everything below is best-effort and must never affect the response
    // already sent to the buyer — payment is captured and confirmed either way.
    try {
      const gstPercent = catalog().meta.gstPercent || 18;
      const items = order.items; // jsonb column comes back parsed
      if (await zoho.isConfigured()) {
        const inv = await zoho.createD2CInvoice({
          orderName,
          paymentId: razorpay_payment_id,
          customer: { name: order.customer_name, email: order.email, phone: order.phone },
          lines: items.map((l) => ({ name: l.name, sku: l.sku, qty: l.qty, rate: l.price, hsn: l.hsn, gstPercent })),
          shipping: Number(order.shipping) || 0,
        });
        await pool.query(`UPDATE bts.orders SET zoho_invoice_id = $2 WHERE order_name = $1`, [orderName, inv.invoiceId]);
      } else {
        console.warn('[checkout/verify] Zoho not configured — order', orderName, 'was NOT invoiced');
      }
    } catch (e) {
      console.error('[checkout/verify] Zoho invoice failed for', orderName, ':', e?.message || e);
    }

    try {
      const leadId = await recordOrderLead({
        customer: { name: order.customer_name, email: order.email, phone: order.phone },
        orderName,
        items: order.items,
        total: order.total,
      });
      if (leadId) await pool.query(`UPDATE bts.orders SET dhanveer_lead_id = $2 WHERE order_name = $1`, [orderName, leadId]);
    } catch (e) {
      console.error('[checkout/verify] Dhanveer bridge failed for', orderName, ':', e?.message || e);
    }
  } catch (e) {
    console.error('[checkout/verify]', e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};
