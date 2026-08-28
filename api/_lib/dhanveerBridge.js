// BTS orders → Dhanveer CRM, so Sales has visibility of every D2C buyer —
// founder-required. Writes DIRECTLY into the shared `dhanveer` Postgres
// schema, the same pattern Dhwani uses to bridge leads into Dhanveer (see
// dhanveer-core's schema.ts + Dhwani's CLAUDE.md "lead bridge" notes),
// rather than calling dhanveer-core's HTTP API — those endpoints require an
// authenticated Chakra session, which a public storefront checkout has no
// way to hold.
//
// Needs its own env var, DHANVEER_DATABASE_URL, pointed at the SAME Neon
// database dhanveer-core uses (schema-per-module) — deliberately separate
// from this project's own DATABASE_URL (the `bts` order-of-record schema),
// since the checkout backend is otherwise independent by design.
//
// Best-effort: a failure here must never fail the checkout. It is NOT
// swallowed silently, though — that exact silent-failure shape has bitten
// this bridge before (Dhwani's CLAUDE.md), so every failure is logged loudly
// enough to be found in Vercel's runtime logs.
const { Pool } = require('pg');
const { pooledUrl } = require('./db');

let pool = null;
function bridgePool() {
  if (!process.env.DHANVEER_DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: pooledUrl(process.env.DHANVEER_DATABASE_URL), ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

function newLeadId() {
  // Namespaced distinctly from dhanveer-core's own count-minted L-#### ids
  // (app-side, racy by design against a shared counter) so a direct-DB
  // insert from here can never collide with one.
  return `L-BTS-${Date.now().toString(36).toUpperCase()}`;
}

async function findLead(p, phone, email) {
  if (phone) {
    const r = await p.query(`SELECT id FROM dhanveer.leads WHERE phone = $1 AND is_deleted IS NOT TRUE LIMIT 1`, [phone]);
    if (r.rows[0]) return r.rows[0].id;
  }
  if (email) {
    const r = await p.query(`SELECT id FROM dhanveer.leads WHERE email = $1 AND is_deleted IS NOT TRUE LIMIT 1`, [email]);
    if (r.rows[0]) return r.rows[0].id;
  }
  return null;
}

async function appendActivity(p, leadId, title, details) {
  const id = `LA-BTS-${Date.now().toString(36).toUpperCase()}`;
  await p.query(
    `INSERT INTO dhanveer.lead_activities (id, lead_id, type, title, details, created_by)
     VALUES ($1, $2, 'order', $3, $4, 'bts-website')`,
    [id, leadId, title, details]
  );
  await p.query(`UPDATE dhanveer.leads SET last_interaction = now(), updated_at = now() WHERE id = $1`, [leadId]);
}

// Creates the lead on a new customer, or appends an order note + bumps
// recency on a repeat one — never a silent no-op on repeat, which is
// exactly the bug that once lost Dhwani's leads (create-only bridges look
// fine on a first order and go quiet on every one after).
async function recordOrderLead({ customer, orderName, items, total }) {
  const p = bridgePool();
  if (!p) {
    console.warn('[dhanveer-bridge] DHANVEER_DATABASE_URL not set — order', orderName, 'was NOT mirrored to Dhanveer CRM');
    return null;
  }
  const itemsLine = items.map((i) => `${i.qty}× ${i.name}`).join(', ');
  const details = `Order ${orderName} — ${itemsLine} — ₹${total} — thebubbleteastore.com`;
  try {
    const existing = await findLead(p, customer.phone || null, customer.email || null);
    if (existing) {
      await appendActivity(p, existing, `BTS order ${orderName}`, details);
      return existing;
    }
    const id = newLeadId();
    await p.query(
      `INSERT INTO dhanveer.leads
         (id, business_name, contact_person, email, phone, city, area, source, tags, status, deal_value, last_interaction, created_at, updated_at)
       VALUES ($1, $2, $2, $3, $4, 'Unknown', '', 'BTS website', $5::jsonb, 'New', $6, now(), now(), now())`,
      [id, customer.name || customer.email || customer.phone || 'BTS customer', customer.email || null, customer.phone || null, JSON.stringify(['bts', 'd2c']), String(total)]
    );
    await appendActivity(p, id, `BTS order ${orderName}`, details);
    return id;
  } catch (e) {
    console.error('[dhanveer-bridge] FAILED to mirror order', orderName, 'into Dhanveer CRM:', e?.message || e);
    return null;
  }
}

module.exports = { recordOrderLead };
