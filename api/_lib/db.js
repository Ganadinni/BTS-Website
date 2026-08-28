// Own order-of-record for BTS — a small Postgres schema (`bts`), deliberately
// separate from dhanveer-core's DB (this checkout backend is independent by
// design). Point DATABASE_URL at a Neon project; pooledUrl() rewrites any
// *.neon.tech host to its -pooler endpoint so this works from Vercel's
// serverless functions without exhausting Neon's direct-connection limit —
// same convention used by every other Chakra/Ganadinni repo (see
// chakra-os-command-center-clone/CLAUDE.md, "Every module connects through
// Neon's POOLER"). DB_POOLER=off opts out.
const { Pool } = require('pg');

function pooledUrl(raw) {
  if (!raw || process.env.DB_POOLER === 'off') return raw;
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith('.neon.tech') && !u.hostname.includes('-pooler')) {
      u.hostname = u.hostname.replace(/(?=\.[^.]+\.neon\.tech$)/, '-pooler');
    }
    return u.toString();
  } catch {
    return raw;
  }
}

let pool = null;
function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: pooledUrl(process.env.DATABASE_URL), ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

let ready = false;
async function ensureSchema() {
  const p = getPool();
  if (!p || ready) return;
  await p.query(`CREATE SCHEMA IF NOT EXISTS bts`);
  await p.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).catch(() => {});
  await p.query(`
    CREATE TABLE IF NOT EXISTS bts.orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_name TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      customer_name TEXT,
      email TEXT,
      phone TEXT,
      address JSONB,
      items JSONB NOT NULL,
      subtotal NUMERIC NOT NULL,
      shipping NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      zoho_invoice_id TEXT,
      dhanveer_lead_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at TIMESTAMPTZ
    )
  `);
  await p.query(`CREATE TABLE IF NOT EXISTS bts.counters (name TEXT PRIMARY KEY, value INT NOT NULL)`);
  ready = true;
}

// Order numbers are minted at checkout-open (create-order), same rule as
// dhanveer-core's nextOrderName(): gaps from abandoned checkouts are normal
// and expected, never "fixed" by renumbering.
async function nextOrderName() {
  const p = getPool();
  await ensureSchema();
  const r = await p.query(
    `INSERT INTO bts.counters (name, value) VALUES ('order', 1)
     ON CONFLICT (name) DO UPDATE SET value = bts.counters.value + 1
     RETURNING value`
  );
  return `BTS-${1000 + r.rows[0].value}`;
}

module.exports = { getPool, ensureSchema, nextOrderName, pooledUrl };
