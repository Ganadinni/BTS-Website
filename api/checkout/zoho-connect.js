// GET /api/checkout/zoho-connect?key=BTS_ADMIN_KEY&code=<Self Client grant code>
// One-time connect: exchanges a Zoho Self Client grant code for a refresh
// token and stores it in bts.sync_state — same no-env-token-dance pattern
// dhanveer-core uses for its own (separate) Zoho connection. Guarded by
// BTS_ADMIN_KEY so this endpoint isn't a public way to hijack the Zoho link.
const zoho = require('../_lib/zoho');

module.exports = async (req, res) => {
  const key = req.query?.key;
  if (!process.env.BTS_ADMIN_KEY || key !== process.env.BTS_ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const code = req.query?.code;
    if (!code) {
      return res.status(200).json({
        configured: await zoho.isConfigured(),
        howTo: 'Generate a Self Client grant code in the Zoho API Console for ZohoBooks.fullaccess.all, then call this URL again with &code=<the code>.',
      });
    }
    await zoho.exchangeGrantCode(code);
    const orgs = await zoho.listOrganizations();
    res.status(200).json({ connected: true, organizations: orgs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
