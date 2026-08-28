// BTS orders → Dhanveer CRM, so Sales has visibility of every D2C buyer —
// founder-required. Calls dhanveer-core's own guarded bridge endpoint over
// HTTPS (POST /api/dhanveer/bridge/lead) rather than writing into its
// database directly: that project's DATABASE_URL is marked Sensitive in
// Vercel (no reveal path), and even if it weren't, handing this independent
// storefront a live write credential to the whole `dhanveer` schema is a
// far bigger blast radius than "create/update one lead per order." See
// dhanveer-core's CLAUDE.md, "2026-08-28 — external-storefront lead
// bridge", for the endpoint's own side of this.
//
// Needs two env vars: DHANVEER_BRIDGE_URL (dhanveer-core's base URL) and
// DHANVEER_BRIDGE_KEY (must match dhanveer-core's BRIDGE_API_KEY exactly).
//
// Best-effort: a failure here must never fail the checkout. It is NOT
// swallowed silently, though — that exact silent-failure shape has bitten
// this bridge before (Dhwani's CLAUDE.md), so every failure is logged loudly
// enough to be found in Vercel's runtime logs. The dedupe-and-append
// discipline (never a silent no-op on a repeat customer) lives in
// dhanveer-core's endpoint itself now, not here.
async function recordOrderLead({ customer, orderName, items, total }) {
  const base = process.env.DHANVEER_BRIDGE_URL;
  const key = process.env.DHANVEER_BRIDGE_KEY;
  if (!base || !key) {
    console.warn('[dhanveer-bridge] DHANVEER_BRIDGE_URL/DHANVEER_BRIDGE_KEY not set — order', orderName, 'was NOT mirrored to Dhanveer CRM');
    return null;
  }
  try {
    const url = `${base.replace(/\/$/, '')}/api/dhanveer/bridge/lead?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: customer.name, email: customer.email || undefined, phone: customer.phone },
        source: 'bts-website',
        orderName,
        items: items.map((i) => ({ qty: i.qty, name: i.name })),
        total,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.success) {
      console.error('[dhanveer-bridge] FAILED to mirror order', orderName, '— HTTP', r.status, JSON.stringify(j));
      return null;
    }
    return j.data?.leadId || null;
  } catch (e) {
    console.error('[dhanveer-bridge] FAILED to mirror order', orderName, 'into Dhanveer CRM:', e?.message || e);
    return null;
  }
}

module.exports = { recordOrderLead };
