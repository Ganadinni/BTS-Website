# BTS-Website — project memory

## 2026-08-29 — abandoned-cart bridge (checkout-open, not just checkout-paid)
Until now `recordOrderLead()` only fired from `api/checkout/verify.js`, after payment —
an order that opened checkout but never paid sat in `bts.orders` as `'pending'` with
**zero visibility to Dhanveer**, no equivalent of dhanveer-core's own
`recoverStuckPayments()` OTP-harvest for its native checkout. Fixed by calling
`recordOrderLead()` a second place, `api/checkout/create-order.js`, the moment the order
row is inserted (after the response is sent, same best-effort/never-blocks-checkout
pattern as `verify.js`) — so a cart is mirrored to Dhanveer as soon as name+phone are in
hand, whether or not it ever converts.
`recordOrderLead()` now takes a `stage` param (`'cart'` | default `'paid'`) that only
changes the `source` string sent to dhanveer-core's bridge endpoint (`'bts-website
(checkout started)'` vs `'bts-website'`) — the endpoint's own phone-then-email dedupe
means a later paid call appends a second activity note to the **same** lead rather than
creating a duplicate, so Sales sees the progression (opened → paid) on one row, not two.
Still blocked on the same two env gaps noted below: `DHANVEER_BRIDGE_KEY` unset, and the
bridge endpoint itself only lives on dhanveer-core's `claude/bts-website-migration-op900p`
branch, not `main` — so today this logs a loud `console.error` and no-ops until both are
resolved, same as the paid-order path already did.

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
  has visibility of BTS D2C buyers. **Revised 2026-08-28, second pass:** the first version wrote
  directly into the shared `dhanveer` Postgres schema (Dhwani's own pattern) using a shared
  `DATABASE_URL` — abandoned once it turned out dhanveer-core's `DATABASE_URL` is marked
  **Sensitive** in Vercel (no reveal path, by design) and, separately, that handing this
  independent storefront a live write credential to the WHOLE `dhanveer` schema was a much
  bigger blast radius than "one lead insert per order," with real open questions (dev-env
  exposure, who owns migrations against a shared DB). Now calls a new, narrow, key-guarded
  endpoint on dhanveer-core instead — `POST /api/dhanveer/bridge/lead?key=$DHANVEER_BRIDGE_KEY`
  (added to dhanveer-core's `src/server/checkout.ts` this session; see its own CLAUDE.md,
  "2026-08-28 — external-storefront lead bridge"). No database credential crosses projects.
  Needs `DHANVEER_BRIDGE_URL` (dhanveer-core's base URL) + `DHANVEER_BRIDGE_KEY` (must exactly
  match dhanveer-core's `BRIDGE_API_KEY`). Best-effort — a bridge failure never blocks checkout
  — but logged loudly (`console.error`), not swallowed: Dhwani's own CLAUDE.md documents exactly
  how a silently-swallowed bridge failure lost leads for weeks before anyone noticed. The
  dedupe-and-append discipline (never a silent no-op on a repeat customer) now lives in
  dhanveer-core's endpoint itself.
- Business decisions locked in by the founder this session: **invoice under GFF** (same entity
  as theteaplanet.com), **same Razorpay merchant account** as theteaplanet.com (its key pair is
  copied into THIS project's own env, not read from dhanveer-core), **separate checkout backend**
  (this repo's own code, not dhanveer-core's API) **on its own, separate database** (not shared
  with dhanveer-core — see the CRM bridge note above for why).

### ⚠️ Still needed before this can take a real payment — see `.env.example`
Nothing above is live yet; every integration is env-gated and degrades to a clear error until
configured (`DATABASE_URL` unset → "Order storage is not configured"; `RAZORPAY_KEY_ID/SECRET`
unset → "Payments are not configured"; Zoho/Dhanveer bridge unset → best-effort skip, logged).
1. **`DATABASE_URL`** — BTS's OWN Neon Postgres connection string, separate from dhanveer-core's.
   Easiest path: this project's Vercel Storage tab → Marketplace → Neon (creates one and injects
   the env var automatically).
2. **`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`** — copy theteaplanet.com's live key pair into
   THIS Vercel project's env (per the founder's "same account" decision above).
3. **`ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET`** — a Zoho Self Client app, then connect via
   `POST /api/checkout/zoho-connect` with JSON body `{ key, code }` — **not** a GET with
   them in the query string (fixed 2026-08-28: that would leak into browser history,
   Vercel's access logs, and Referer headers for a value with full Books access). Mirrors
   dhanveer-core's own connect flow, but stores the refresh token in THIS project's own
   `bts.sync_state`, not dhanveer's).
4. **`DHANVEER_BRIDGE_URL` / `DHANVEER_BRIDGE_KEY`** — set `BRIDGE_API_KEY` on dhanveer-core
   first, then copy the SAME value here as `DHANVEER_BRIDGE_KEY` (`DHANVEER_BRIDGE_URL` defaults
   to `https://dhanveer-core.vercel.app`).
5. **Real SKUs** — `BTS-WEB-00N` are interim placeholders (same convention theteaplanet-website
   already uses for un-SKUed products). Per Medhavi's CLAUDE.md, **SKUs are founder-issued only,
   never inferred** — until the Product Master assigns real base SKUs/blend codes for these 6
   kits (`ganadinni-product-master/BRAND-SKUS-NEEDED-2026-08-22.csv` already has 12 BTS rows
   awaiting one), Zoho invoices will create fresh ad-hoc line items rather than matching a real
   item master row — same gap already flagged for Thai Milk Tea on theteaplanet.com.
6. **HSN / exact GST rate per kit** — declared as 18% GST-inclusive (matching the Shopify
   store's configured effective rate) but not yet accountant-confirmed for a bundled kit
   (tea premix + reusable plastic cups + straws don't all sit at one HSN in isolation).
7. **First real end-to-end test order** before this goes fully live — same discipline
   theteaplanet.com's own checkout followed (Magic Checkout was never flipped from 'off' to
   'optional' until one real payment verified end-to-end).
8. **Deploy**: pushed to `claude/bts-website-migration-op900p`; this project's Vercel deploy is
   already connected (see the 2026-08-25 entry below) — confirm the live build once pushed.

### Env setup — progress as of the founder's own pass through Vercel (same day)
- ✅ **`DATABASE_URL`** done — own Neon database (`bts-website-db`, region `sin1`/Singapore,
  free plan, Neon Auth off), connected across Production/Preview/Development. The variable
  PREFIX was set to `DATABASE` on creation so Neon's Vercel integration injects `DATABASE_URL`
  directly (its default prefix would have produced `STORAGE_URL` instead — worth knowing if
  this is ever redone). Left as **Config, not Sensitive** — deliberately, because Development
  scope was requested and `vercel env pull` cannot retrieve a Sensitive value at all.
- ✅ **`DHANVEER_BRIDGE_URL`** done — `https://dhanveer-core.vercel.app`, Production + Preview,
  set as Config (it's a public URL, not a secret).
- ⚠️ **`DHANVEER_BRIDGE_KEY`** — NOT set. Correctly refused to be minted by a Chrome agent or by
  Claude: putting a fresh secret's value into a chat transcript is exactly the exposure the
  "source dashboard → Vercel's field, never through a chat window" rule exists to prevent, even
  though it's a brand-new value rather than an extracted one. **Founder generates this one
  personally** (any long random string — a password manager, `openssl rand -hex 32` in a
  terminal that isn't logged anywhere, etc.) and pastes the SAME value into both this project's
  `DHANVEER_BRIDGE_KEY` and dhanveer-core's `BRIDGE_API_KEY`.
- ❌ **`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`** — blocked. Both are marked **Sensitive** in
  dhanveer-core's Vercel env (no reveal, no copy — confirmed by the same padlock-vs-eye-icon
  check used on `DATABASE_URL`). Notably `RAZORPAY_KEY_ID` is Sensitive too, which is stricter
  than it needs to be (Key IDs are public — they ship to the browser in Razorpay's own checkout
  widget) but that's dhanveer-core's existing configuration, not something to change here.
  **Fallback: Razorpay's own dashboard** (`dashboard.razorpay.com` → Settings → API Keys) — Key
  ID is always visible there; Key Secret is normally shown only once, at generation. If it isn't
  saved anywhere (password manager etc.), the only way to get a usable one is to regenerate it
  in Razorpay's dashboard — which ROTATES the live key and would break theteaplanet.com's
  checkout until dhanveer-core's own env is updated to match. **Do not do this without the
  founder explicitly choosing to, and coordinating both projects' env vars together** — it's a
  live-payments-affecting action, not a setup step to run casually.
- ✅ **Zoho org — already resolved, no decision needed.** The Zoho account has three orgs
  (TPGB `60014654138` Professional · GFF `60015387691` Free · "The Tea Planet - GST"
  `60026481586` Free) — `zoho.js`'s `ORG_GFF` already hardcodes `60015387691` (GFF), matching
  the founder's "invoice under GFF" decision from earlier this session. `listOrganizations()`
  in the connect response is just proof the token works across every org it can see; it is
  informational, not a selection the founder needs to make.
- ✅ `.in` confirmed as the correct Zoho accounts/API domain (all three orgs are `version:
  india`) — `zoho.js`'s defaults (`accounts.zoho.in` / `www.zohoapis.in`) were already right.
- 🔧 **Fixed the same day**: `POST /api/checkout/zoho-connect` used to take `key`/`code` as GET
  query-string params — flagged during this setup pass as landing in browser history, Vercel's
  access logs, and Referer headers for a value with full `ZohoBooks.fullaccess.all` access.
  Both now go in a POST body instead; 404 (not 403) on a bad/missing key, matching every other
  guarded route in this codebase.
- ⚠️ **`BTS_ADMIN_KEY` also deliberately not minted here**, same reasoning as
  `DHANVEER_BRIDGE_KEY` above — founder generates and pastes it directly.

### ✅ RESOLVED 2026-08-29 — the Dhanveer bridge endpoint IS in production now
The branch was merged to dhanveer-core's `main` (`8a67530` "Merge main into
claude/bts-website-migration-op900p before promoting to production", founder-authored) and a
same-day fix (`619429c`, "bridge/lead endpoint was 401ing before its own key check ran" — the
route wasn't in `serverAuth.ts`'s `PUBLIC` allow-list, so `requireAuth` 401'd it before its own
`BRIDGE_API_KEY` check ever ran) both shipped. Confirmed via Vercel's deployment metadata: the
live production deployment of `dhanveer-core` (`dpl_DRvctmJcNyTZwxPFxeAbfpbFAU5i`, commit
`92aea21` on `main`) descends from both. `dhanveer-core.vercel.app` now serves this route for
real. `BRIDGE_API_KEY` (dhanveer-core) and `DHANVEER_BRIDGE_KEY` (bts-website) were also
rotated to a matching fresh value this same session and both projects redeployed — see the
"2026-08-29 — abandoned-cart bridge" entry above for the code side. The bridge should now work
end-to-end; not yet verified with a real order because Razorpay keys are still unset on
bts-website (see "Still needed" above), so no checkout can complete to trigger it.

### Shopify theme backup — Flux (live) + draft archived; Dawn still outstanding (2026-08-28)
Before the Shopify store is deleted, the theme *code* (not just the rendered site, already
extracted as `bts-image-manifest-179.csv` + the pushed image archive) needs backing up: **Flux**
(live), **"Updated copy of Flux"** (draft), **Dawn** (stock draft, low priority — unmodified
16.0.0, recoverable from Shopify itself any time).

⚠️ **There is no in-browser download for a theme's code in this admin — only email.**
Online Store → Themes → Actions → "Download theme file" opens a dialog reading exactly *"Your
theme files will be emailed to connect@thebubbleteastore.com"* with two buttons (Cancel / Send
email) — no code field, no resend, no alternate address, no direct-download path. Confirmed
identical on both Flux themes via a Chrome agent. So this cannot be pulled through this session
or a browser agent alone; it needs (a) the send triggered in the admin and (b) someone with
access to that inbox to retrieve the resulting link before it expires.

**Status of the sends:** Flux (live) — ✅ confirmed sent, "Theme files sent" toast seen. Updated
copy of Flux — ⚠️ unconfirmed after three attempts (stale toast, a send button stuck
greyed-out/loading, then no toast at all) — check the inbox itself to know if it landed. Dawn —
not attempted; the Themes page started failing to render on repeated reloads and the agent
stopped rather than keep retrying blind next to **Delete**, which sits 38px below Download
theme file in the same per-theme menu on the draft cards.

**Resolved:** both theme emails landed. Both zips extracted (341 files / 5.3 MB live, 331 files
/ 5.0 MB draft, standard Shopify theme structure — `assets`, `sections`, `snippets`, `templates`,
`config`, `locales`, `layout`) and archived at `archive/shopify-export/themes/flux-live/` and
`archive/shopify-export/themes/updated-copy-of-flux/`. Scanned for credentials before commit —
clean; the only `password`/`token`-adjacent matches were Shopify's own password-page section
names (`main-password-header`, `main-password-footer`) and customer-auth template boilerplate,
not real secrets. **Founder-ruled 2026-08-28: this is reference only** — "we will design
ourselves with the images we got." The live storefront keeps its own "cup is the unit" identity
(`assets/css/tokens.css` / `site.css`), built from the extracted product images; the Flux theme
is not being ported, cloned, or used as the site's design. Mine it for copy/structure/content
only if something specific is needed later.

**Still outstanding:** Dawn (stock, unmodified 16.0.0) — lowest priority, byte-identical to a
fresh Shopify download any time, so not worth chasing through the flaky admin. If it's ever
wanted, `shopify theme pull --store 1e9m5n-b1` is cleaner than another email round.

## State as of 2026-08-25 (handoff from the session that stood this up)
- **Repo:** `Ganadinni/BTS-Website` (GitHub renamed its canonical casing from the
  `bts-website` you typed — same repo, URLs redirect either way).
- **Was completely empty** — zero commits, no default branch — which is why it
  wouldn't show up to import into Vercel. Fixed by pushing a first commit
  (`main`, author `founder@theteaplanet.com`, matching this org's deploy
  convention everywhere else): a placeholder `index.html` ("BTS — Coming
  Soon" holding page, `noindex`) + this file.
- **Connected to Vercel** — team `founder-9869's projects`. ⚠️ **Two
  projects got created from the same import**, ~74 seconds apart, both
  linked to this repo: `bts-website` (`prj_xPrboy6ZdUEywrgeuoI0gaa2iDtg`,
  created first) and `bts-website-cags` (`prj_8kS8tMGhRAivZVax5DxBSmAvq229`,
  created second — got the auto-suffix because the plain name collided
  with its own sibling). **`bts-website` is canonical**; verified live at
  **https://bts-website-two.vercel.app** (the `-two` suffix is because
  plain `bts-website.vercel.app` is already claimed by an unrelated
  project elsewhere on Vercel — nothing to do with the duplicate above).
  `bts-website-cags` is pending deletion by the founder (Settings →
  Advanced → Delete Project) — if a future session finds only one project
  linked to this repo, that cleanup is done; ignore this note.
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
