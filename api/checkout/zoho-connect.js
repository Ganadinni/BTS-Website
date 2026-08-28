// POST /api/checkout/zoho-connect  { key, code? }
// One-time connect: exchanges a Zoho Self Client grant code for a refresh
// token and stores it in bts.sync_state — same no-env-token-dance pattern
// dhanveer-core uses for its own (separate) Zoho connection.
//
// POST with the key/code in the body, not a GET with them in the query
// string (fixed 2026-08-28, flagged during setup): a query string lands in
// browser history, Vercel's access logs, and any Referer header a page
// navigated away from this URL would send — real exposure for a value that
// hands out full ZohoBooks.fullaccess.all. 404 (not 403) on a bad/missing
// key, same as every other guarded route in this codebase, so the route
// doesn't announce its own existence to a prober.
const zoho = require('../_lib/zoho');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(404).end();
  const key = req.body?.key;
  if (!process.env.BTS_ADMIN_KEY || key !== process.env.BTS_ADMIN_KEY) {
    return res.status(404).end();
  }
  try {
    const code = req.body?.code;
    if (!code) {
      return res.status(200).json({
        configured: await zoho.isConfigured(),
        howTo: 'Generate a Self Client grant code in the Zoho API Console for ZohoBooks.fullaccess.all, then POST again with { key, code }.',
      });
    }
    await zoho.exchangeGrantCode(code);
    const orgs = await zoho.listOrganizations();
    res.status(200).json({ connected: true, organizations: orgs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
