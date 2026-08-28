// Razorpay Standard checkout — REST calls with Basic auth (no SDK dependency).
// Reuses the SAME merchant account as theteaplanet.com per founder decision;
// set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to that account's live (or test)
// key pair in this project's own Vercel env — they are not read from
// dhanveer-core, each Vercel project holds its own copy of the same values.
const crypto = require('crypto');

const configured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

function authHeader() {
  const token = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

async function createOrder({ amountPaise, receipt, notes }) {
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt, notes }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Razorpay create-order HTTP ${r.status}: ${j?.error?.description || 'unknown error'}`);
  return j;
}

function verifySignature({ orderId, paymentId, signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

async function fetchPayment(paymentId) {
  const r = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Razorpay fetch-payment HTTP ${r.status}`);
  return r.json();
}

module.exports = { configured, createOrder, verifySignature, fetchPayment };
