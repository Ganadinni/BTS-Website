// Server-side pricing authority — mirrors theteaplanet.com's checkout.ts
// pattern (dhanveer-core): the page's displayed price is never trusted, every
// amount is recomputed here from the site's own catalog.json by SKU.
//
// Loaded via a literal require() path, not fs.readFileSync(process.cwd()+…):
// Vercel's Node runtime traces file dependencies statically (@vercel/nft) to
// decide what ships in the function bundle, and a dynamic runtime path is
// invisible to that trace — works locally, 404s/ENOENTs in production. A
// literal require() of the JSON is traced correctly.
const data = require('../../assets/data/catalog.json');

let cache = null;
function catalog() {
  if (cache) return cache;
  cache = { meta: data, bySku: new Map(data.products.map((p) => [p.sku, p])) };
  return cache;
}

function priceFor(sku) {
  const { bySku } = catalog();
  return bySku.get(sku) || null;
}

// Domestic-only for now (international "market" was never actually
// configured on the old Shopify store either — see the rebuild brief).
function shippingFor(subtotal, country) {
  if (country && country !== 'IN' && country !== 'India') {
    return { amount: null, note: 'International shipping is not available yet — contact us.' };
  }
  return { amount: 0, note: 'Free shipping across India' };
}

module.exports = { catalog, priceFor, shippingFor };
