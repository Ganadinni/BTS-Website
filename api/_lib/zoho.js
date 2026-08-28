// Zoho Books — GFF org only (founder decision: all BTS orders invoice under
// GFF, same entity as theteaplanet.com). Independent credentials from
// dhanveer-core by design (separate checkout backend); the connect flow
// below lets the founder link Zoho to THIS Vercel project without needing
// dhanveer's stored refresh token. Env:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET  — a Zoho Self Client app
//   ZOHO_REFRESH_TOKEN                  — set by /api/checkout/zoho-connect,
//                                          or pasted in by hand as a fallback
//   ZOHO_ORG_GFF (optional, defaults to the group's known GFF org id)
//   ZOHO_ACCOUNTS_DOMAIN / ZOHO_API_DOMAIN (optional, default India)
const { getPool, ensureSchema } = require('./db');

const ACCOUNTS = () => process.env.ZOHO_ACCOUNTS_DOMAIN || 'accounts.zoho.in';
const API = () => process.env.ZOHO_API_DOMAIN || 'www.zohoapis.in';
const ORG_GFF = () => process.env.ZOHO_ORG_GFF || '60015387691';

async function storedRefreshToken() {
  const p = getPool();
  if (!p) return null;
  try {
    await ensureSchema();
    await p.query(`CREATE TABLE IF NOT EXISTS bts.sync_state (key TEXT PRIMARY KEY, value TEXT)`);
    const r = await p.query(`SELECT value FROM bts.sync_state WHERE key = 'zoho_refresh_token'`);
    return r.rows[0]?.value || null;
  } catch {
    return null;
  }
}
async function storeRefreshToken(token) {
  const p = getPool();
  if (!p) return;
  await ensureSchema();
  await p.query(`CREATE TABLE IF NOT EXISTS bts.sync_state (key TEXT PRIMARY KEY, value TEXT)`);
  await p.query(
    `INSERT INTO bts.sync_state (key, value) VALUES ('zoho_refresh_token', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [token]
  );
}

async function currentRefreshToken() {
  const stored = await storedRefreshToken();
  return stored || process.env.ZOHO_REFRESH_TOKEN || null;
}

async function isConfigured() {
  return !!(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && (await currentRefreshToken()));
}

async function exchangeGrantCode(code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
  });
  const r = await fetch(`https://${ACCOUNTS()}/oauth/v2/token`, { method: 'POST', body: params });
  const j = await r.json();
  if (!j.refresh_token) throw new Error(`Zoho exchange failed: ${j.error || JSON.stringify(j).slice(0, 120)}`);
  await storeRefreshToken(j.refresh_token);
  return { refreshToken: j.refresh_token };
}

let cachedToken = null;
async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const refreshToken = await currentRefreshToken();
  if (!refreshToken) throw new Error('No Zoho refresh token — connect via /api/checkout/zoho-connect');
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const r = await fetch(`https://${ACCOUNTS()}/oauth/v2/token?${params.toString()}`, { method: 'POST' });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Zoho auth failed: ${JSON.stringify(j).slice(0, 200)}`);
  cachedToken = { token: j.access_token, expiresAt: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return cachedToken.token;
}

async function zoho(path, method = 'GET', body) {
  const token = await accessToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://${API()}/books/v3${path}${sep}organization_id=${ORG_GFF()}`;
  const r = await fetch(url, {
    method,
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json();
  if (j.code && j.code !== 0) throw new Error(`Zoho ${path}: ${j.message || 'error'}`);
  return j;
}

async function findOrCreateCustomer(c) {
  if (c.email) {
    const byEmail = await zoho(`/contacts?email=${encodeURIComponent(c.email)}`);
    if (byEmail.contacts?.length) return byEmail.contacts[0].contact_id;
  }
  const byName = await zoho(`/contacts?contact_name=${encodeURIComponent(c.name)}`);
  if (byName.contacts?.length) return byName.contacts[0].contact_id;
  const created = await zoho('/contacts', 'POST', {
    contact_name: c.name,
    company_name: c.name,
    contact_type: 'customer',
    ...(c.email ? { contact_persons: [{ email: c.email, is_primary_contact: true, ...(c.phone ? { phone: c.phone } : {}) }] } : {}),
  });
  return created.contact?.contact_id;
}

async function markInvoicePaid(inv, paymentRef, orderName) {
  if ((inv.status || 'draft') === 'draft') {
    await zoho(`/invoices/${inv.invoice_id}/status/sent`, 'POST');
  }
  const amount = inv.balance != null ? Number(inv.balance) : Number(inv.total || 0);
  if (!amount || amount <= 0) return;
  await zoho('/customerpayments', 'POST', {
    customer_id: inv.customer_id,
    payment_mode: 'banktransfer',
    amount,
    date: new Date().toISOString().slice(0, 10),
    reference_number: String(paymentRef).slice(0, 50),
    invoices: [{ invoice_id: inv.invoice_id, amount_applied: amount }],
    notes: `Razorpay ${paymentRef} — thebubbleteastore.com order ${orderName}`,
  });
}

// Site prices are tax-inclusive MRP (is_inclusive_tax: true) — Zoho
// back-computes the GST split from each line's tax_percentage. Idempotent
// on the order name via reference_number, so a retried verify never
// double-invoices.
async function createD2CInvoice(o) {
  const dup = await zoho(`/invoices?reference_number=${encodeURIComponent(o.orderName)}`);
  if (dup.invoices?.length) {
    const d = dup.invoices[0];
    if (d.status !== 'paid') {
      try { await markInvoicePaid(d, o.paymentId, o.orderName); }
      catch (e) { console.warn('[zoho] mark-paid on existing invoice failed:', e?.message); }
    }
    return { invoiceId: d.invoice_id, invoiceNumber: d.invoice_number, existed: true };
  }
  const customerId = await findOrCreateCustomer({
    name: o.customer.name || o.customer.email || o.customer.phone || 'Website customer',
    email: o.customer.email,
    phone: o.customer.phone,
  });
  const res = await zoho('/invoices', 'POST', {
    customer_id: customerId,
    reference_number: o.orderName,
    is_inclusive_tax: true,
    line_items: o.lines.map((l) => ({
      name: String(l.name || l.sku || 'Item').slice(0, 200),
      description: l.sku ? `SKU ${l.sku}` : '',
      rate: l.rate,
      quantity: l.qty,
      ...(l.hsn ? { hsn_or_sac: String(l.hsn) } : {}),
      tax_percentage: l.gstPercent,
    })),
    ...(o.shipping ? { shipping_charge: o.shipping } : {}),
    notes: `thebubbleteastore.com order ${o.orderName} · Razorpay payment ${o.paymentId} (paid)`,
  });
  try {
    await markInvoicePaid(
      { invoice_id: res.invoice?.invoice_id, customer_id: customerId, total: res.invoice?.total, balance: res.invoice?.balance, status: res.invoice?.status || 'draft' },
      o.paymentId,
      o.orderName
    );
  } catch (e) {
    console.warn('[zoho] record payment failed (invoice stays unpaid):', e?.message);
  }
  return { invoiceId: res.invoice?.invoice_id, invoiceNumber: res.invoice?.invoice_number };
}

module.exports = { isConfigured, exchangeGrantCode, createD2CInvoice, listOrganizations: () => zoho('/organizations') };
