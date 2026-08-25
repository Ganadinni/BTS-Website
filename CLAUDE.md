# BTS-Website — project memory

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

## Open, for the next session to settle before building
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
