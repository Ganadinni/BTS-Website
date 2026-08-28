# BTS-Website — project memory

## State as of 2026-08-28 — the migration is built, RESOLVES the 08-25 "Open" items below
**This repo now IS the replacement for `thebubbleteastore.com`** (the Shopify store) —
resolving the "do not conflate" open question from 2026-08-25: the founder confirmed this
session that the migration direction is thebubbleteastore.com → this repo, as a full D2C
storefront, and the "exit Shopify first" ruling mentioned below is exactly what this build is.

### What's live in the repo (not yet deployed with real credentials — see "Still needed")
- **Catalog migrated from Shopify** (`connect@thebubbleteastore.com`, exported by hand since
  the account's own inbox isn't reachable from an agent sandbox): 6 DIY kits — Blue Hawaii,
  Bubblegum, Classic Matcha, Spiced Chai, Taro, Thai — ₹699 (MRP ₹1,799), 1.05 kg, 4 servings
  each, single flat collection. Source data lives in the migration's scratchpad, not this repo;
  `assets/data/catalog.json` is the canonical corrected version going forward.
- **Data problems found in the Shopify source were fixed on migration, not carried over:**
  `Charge tax = No` on every product despite the store's 18% GST config (this site declares
  18% GST-inclusive consistently — flag to the accountant if that rate is wrong for a bundled
  kit); blank SKUs (now placeholder `BTS-WEB-00N` — **these are NOT real Product Master SKUs,
  see below**); vendor "My Store" (now "BTS" / "The Tea Planet"); tags that just duplicated
  titles (now retagged by flavour family / topping / occasion).
- **Design system — "the cup is the unit"** (founder-approved artifact, see the design
  session): Fraunces (display) + Sora (body/UI), ink/paper/pop/tea/smoke tokens
  (`assets/css/tokens.css`), cup-silhouette cards (`assets/css/site.css`). Deliberately its own
  identity, not theteaplanet-website's Instrument Serif/leaf-green system — BTS is a distinct
  consumer brand, not a Tea Planet sub-line.
- **Static frontend**: home, `/products/` (collection), 6 PDPs, all generated from
  `assets/data/catalog.json` by a build script (kept outside this repo, in the migration
  scratchpad — re-run it, don't hand-edit the generated HTML, if the catalog changes).
  Product images still hotlink Shopify's CDN (`cdn.shopify.com/...`) — fine short-term, but
  should move to owned hosting before Shopify is fully decommissioned (same lesson
  theteaplanet-website learned migrating off Cloudinary to Cloudflare R2).
- **Checkout backend — INDEPENDENT of dhanveer-core, by founder decision** (`api/checkout/*`,
  `api/_lib/*`): its own Razorpay integration (`api/_lib/razorpay.js`, REST calls, no SDK), its
  own Zoho Books integration scoped to the **GFF org only** (`api/_lib/zoho.js`, ported from
  dhanveer-core's `createD2CInvoice` pattern — draft invoice → marked paid, since the money is
  already captured via Razorpay), and its **own** order-of-record table (`bts.orders`) in its
  own Postgres DB — deliberately not dhanveer-core's `dhanveer.orders`, so nothing here can ever
  affect the live theteaplanet.com checkout.
- **Dhanveer CRM bridge** (`api/_lib/dhanveerBridge.js`) — founder-required: every paid order
  becomes or updates a lead in `dhanveer.leads` (+ a `dhanveer.lead_activities` note), so Sales
  has visibility of BTS D2C buyers. Writes DIRECTLY into the shared `dhanveer` schema (same
  pattern Dhwani uses to bridge its leads into Dhanveer — see dhanveer-core's schema.ts) rather
  than calling dhanveer-core's HTTP API, because those endpoints require an authenticated
  Chakra session that a public storefront has no way to hold. **Uses the SAME `DATABASE_URL`
  as this project's own `bts` schema** (founder decision 2026-08-28: connect BTS to the
  existing shared Neon database rather than a new one — simpler, one connection string does
  both jobs); `DHANVEER_DATABASE_URL` is only needed as an override if the two are ever split
  apart later. Best-effort — a bridge failure never blocks checkout — but logged loudly
  (`console.error`), not swallowed: Dhwani's own CLAUDE.md documents exactly how a
  silently-swallowed bridge failure lost leads for weeks before anyone noticed.
- Business decisions locked in by the founder this session: **invoice under GFF** (same entity
  as theteaplanet.com), **same Razorpay merchant account** as theteaplanet.com (its key pair is
  copied into THIS project's own env, not read from dhanveer-core), **separate checkout backend**
  (this repo's own code, not dhanveer-core's API) **on the existing shared Neon database**
  (its own `bts` schema inside it, not a new database).

### ⚠️ Still needed before this can take a real payment — see `.env.example`
Nothing above is live yet; every integration is env-gated and degrades to a clear error until
configured (`DATABASE_URL` unset → "Order storage is not configured"; `RAZORPAY_KEY_ID/SECRET`
unset → "Payments are not configured"; Zoho unset → best-effort skip, logged).
1. **`DATABASE_URL`** — the EXISTING shared Neon connection string (copy it from any Chakra
   module's Vercel env, e.g. dhanveer-core's `DATABASE_URL`). This also powers the Dhanveer CRM
   bridge — no second database or second env var needed.
2. **`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`** — copy theteaplanet.com's live key pair into
   THIS Vercel project's env (per the founder's "same account" decision above).
3. **`ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET`** — a Zoho Self Client app, then connect via
   `GET /api/checkout/zoho-connect?key=<BTS_ADMIN_KEY>&code=<grant code>` (mirrors
   dhanveer-core's own connect flow, but stores the refresh token in THIS project's own
   `bts.sync_state`, not dhanveer's).
4. **Real SKUs** — `BTS-WEB-00N` are interim placeholders (same convention theteaplanet-website
   already uses for un-SKUed products). Per Medhavi's CLAUDE.md, **SKUs are founder-issued only,
   never inferred** — until the Product Master assigns real base SKUs/blend codes for these 6
   kits (`ganadinni-product-master/BRAND-SKUS-NEEDED-2026-08-22.csv` already has 12 BTS rows
   awaiting one), Zoho invoices will create fresh ad-hoc line items rather than matching a real
   item master row — same gap already flagged for Thai Milk Tea on theteaplanet.com.
5. **HSN / exact GST rate per kit** — declared as 18% GST-inclusive (matching the Shopify
   store's configured effective rate) but not yet accountant-confirmed for a bundled kit
   (tea premix + reusable plastic cups + straws don't all sit at one HSN in isolation).
6. **First real end-to-end test order** before this goes fully live — same discipline
   theteaplanet.com's own checkout followed (Magic Checkout was never flipped from 'off' to
   'optional' until one real payment verified end-to-end).
7. **Deploy**: pushed to `claude/bts-website-migration-op900p`; this project's Vercel deploy is
   already connected (see the 2026-08-25 entry below) — confirm the live build once pushed.

## State as of 2026-08-25 (handoff from the session that stood this up)
- **Repo:** `Ganadinni/BTS-Website` (GitHub renamed its canonical casing from the
  `bts-website` you typed — same repo, URLs redirect either way).
- **Was completely empty** — zero commits, no default branch — which is why it
  wouldn't show up to import into Vercel. Fixed by pushing a first commit
  (`main`, author `founder@theteaplanet.com`, matching this org's deploy
  convention everywhere else): a placeholder `index.html` ("BTS — Coming
  Soon" holding page, `noindex`) + this file.
- **Connected to Vercel** — team `founder-9869's projects`, project renamed
  from the auto-generated `bts-website-cags` to **`bts-website`**. Live and
  serving the placeholder (confirmed 200). Check the project's Settings →
  Domains for the exact current `*.vercel.app` URL — it moved when the
  project was renamed.
- **Nothing else exists yet.** No framework, no design direction, no content,
  no brand asset pack pulled in. The placeholder is throwaway — replace it
  outright rather than building on top of it.

## What "BTS" is, from the rest of the Ganadinni/Chakra ecosystem
Pulled from other repos' CLAUDE.md files so this doesn't have to be
rediscovered. Nothing below was decided in this repo — verify against the
source before treating it as settled for THIS site.

- **BTS = "Bubble Tea Shop"**, one of five brands the group sells under
  (TTP · 9T9 · BOPL · BTS · BD/Big Daddy) — see
  `ganadinni-product-master/CLAUDE.md`. It's a DIY-kit-oriented brand: BTS
  premixes fold into the same category codes as The Tea Planet's, but
  **toppings (nata, tapioca, popping boba) ride the Tea Planet SKU directly**
  — a topping isn't diluted per-brand the way a premix is.
  - As of the last product-master pass, **30 BTS rows carry a blend code**
    (two founder-minted this session: Bubblegum Nata de Coco `17177`,
    Peach Tapioca Pearls `17091`); **7 Combo Kits carry none by design**
    (`CAT_NO_BLEND` — an assembly of existing products isn't itself a
    formulation).
  - Founder's stated intent: **Combo Kits sell as kits, the individual
    items inside them as refills** — a refill is a pack of an EXISTING
    blend (e.g. `41010.1`), never a new blend of its own.
  - ⚠️ **The kit BOMs (what's actually inside each combo) are NOT
    verified anywhere** — what's known came from search snippets, not
    from reading the store. Don't assume a kit's contents without checking.
  - A prior "Kit Bubble Tea Mixes" category (`bts-mixes`, 23 products) was
    **removed** on a founder ruling — most of those rows were just Tea
    Planet blends re-listed as separate BTS products.
- **`dhanveer-core`** carries `BTS` as a short brand code
  (`EXPORT_BRAND_NAMES.BTS = 'Bubble Tea Shop'`) used on the Export Quote/
  Invoice line-item Brand column — confirms it's a real, currently-sold
  brand, not a shelved one.
- **On Amazon**, "BTS by Tea Planet" is one of four fragmented seller
  identities for DIY kits (see `theteaplanet-website/CLAUDE.md`,
  2026-06-30 session note) — alongside "The Tea Planet" (old gen), "Tea
  Planet" (new gen), and the "Tiger Boba" RTD-can sub-brand.

## ⚠️ Do not conflate this with `thebubbleteastore.com`
A separate, unrelated live brand domain (`thebubbleteastore.com`) turned up
during an earlier investigation this session (see
`ganadinni-product-master/CLAUDE.md` → "PARKED — thebubbleteastore.com").
It's on Shopify, administered under a **different login**
(`connect@thebubbleteastore.com`), not `founder@theteaplanet.com`, and the
founder's ruling there was to exit Shopify first before touching it further.
**Nothing ties it to this BTS-Website repo** — they may be the same brand
concept or may not be; that was never resolved. Confirm with the founder
before assuming this new site replaces, mirrors, or relates to that domain.

## Open, for the next session to settle before building — RESOLVED 2026-08-28, kept for history
Answered above: this site is a full D2C storefront replacing thebubbleteastore.com's Shopify
store; it's a static site + its own Vercel serverless API (not a Chakra Vite/Express module);
it gets its own design identity, not theteaplanet-website's tokens.
- What this site is actually FOR (storefront? catalogue/lookbook? landing
  page linking to a marketplace listing?) and who it's for (consumer D2C,
  or B2B like the BTS combo-kit trade).
- Tech approach — the rest of this org's public sites are static HTML
  (`theteaplanet-website`) or Vite+Express Chakra modules
  (`dhanveer-core` etc). Neither is assumed here; pick deliberately.
- Whether it reuses `theteaplanet-website`'s design tokens/fonts (Instrument
  Serif + DM Sans, `--leaf-900`/`--gold-500`/`--cream`) for brand
  consistency, or gets its own identity — BTS is a distinct brand, not a
  Tea Planet sub-line, so a separate identity may be intended.
- Deploy convention to carry forward: commit as `founder@theteaplanet.com`
  (matches every other repo here); this session's sandbox has the shared
  egress/deploy gotchas documented once in
  `chakra-os-command-center-clone/CLAUDE.md` → "Working these repos from
  the agent sandbox" (`mcp__Vercel__web_fetch_vercel_url` is the only way
  to read a deployed Vercel URL from an agent sandbox; production/preview
  builds dedupe by commit SHA; etc.) — worth reading if a future session
  hits a "the site looks unreachable" false alarm.
