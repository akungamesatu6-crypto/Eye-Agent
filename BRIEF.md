# EYE AGENT — BRIEF (2026-11-18)

User order 2026-11-18 10:23 WIB: "buatkan serapih mungkin, sesuaikan nama jumlah suplai, dengan halaman website lengkap struktur yang komplit, tambahkan juga beberapa artwork untuk jumlah 1,001, buatkan rarity yang sesuai, sistem pembayaran sama dengan HATCHIEggy mulai dari 0,0005".
Reference: user-uploaded golden celestial eye image (workspace/user/media_library/image/file_00000000674c821185e6bc9d5fa80f2c.png).

## Identity (Tania's choice, user delegated "sesuaikan nama")
- **Name: Eye Agent** — NFT symbol EYE, token **$EYE**
- Tagline: "Every Eye Sees Differently." (proposal)
- X handle proposal: **@EyeAgentNFT** (UNCONFIRMED — do not present as live)
- Language: EN only (HATCHIEggy model; user never specified — can add later)
- Repo (proposal): akungamesatu6-crypto/Eye-Agent — repo must be CREATED via browser task (GitHub App cannot create repos)
- Vercel (proposal): project `eye-agent`, team akungamesatu6-4875s-projects, https://eye-agent.vercel.app/ — check name availability at creation; STOP if taken
- baseURI: https://eye-agent.vercel.app/metadata/

## Supply + artwork (8 artworks, all Tania-generated, visually verified)
Style: elegant mystical 2D eye, delicate gold orbital rings + sparkles (Silver/Lunar uses silver rings), soft white background, premium trading-card art, no text/watermark. Originals (webp) in `~/workspace/eye-project/assets/`; compress to 1200×1200 JPG q82 as `assets/<slug>.jpg` for the page/metadata.

| Eye | Slug | File | IDs | Tier |
|---|---|---|---|---|
| Azure Gaze | azure | media-generation-eye-azure-0-a2d911b0-e0f4-4528-aa98-cbb96f6aeb95.webp | 1–250 | Common |
| Emerald Gaze | emerald | media-generation-eye-emerald-0-d2a70530-034b-4fb3-8fb4-e55dec7628b4.webp | 251–500 | Common |
| Violet Gaze | violet | media-generation-eye-violet-0-edd3ded1-d42d-428e-b0b7-19f75e7ee950.webp | 501–625 | Rare |
| Rose Gaze | rose | media-generation-eye-rose-0-cfd15ed7-3ff2-450d-87fd-31f5b22a2a1c.webp | 626–750 | Rare |
| Crimson Gaze | crimson | media-generation-eye-crimson-0-1f9a9418-0d71-43b2-989d-37aed87d0c87.webp | 751–825 | Epic |
| Lunar Gaze | silver | media-generation-eye-silver-0-937194e8-5128-4858-a8bc-18c9111ff062.webp | 826–900 | Epic |
| Onyx Gaze | onyx | media-generation-eye-onyx-0-f6dca34c-325c-4698-b626-1fed83fdc35b.webp | 901–975 | Legendary |
| The Golden Gaze | golden | media-generation-eye-golden-0-421cbd9a-c883-41f0-a805-65f6c45f1ff8.webp | 976–1001 | Mythic (hero) |

## Rarity (supply 1,001, SEQUENTIAL mint — id = totalMinted + 1)
- Common 500 (Azure 250 + Emerald 250) — IDs 1–500
- Rare 250 (Violet 125 + Rose 125) — IDs 501–750
- Epic 150 (Crimson 75 + Lunar 75) — IDs 751–900
- Legendary 75 (Onyx) — IDs 901–975
- Mythic 26 (The Golden Gaze) — IDs 976–1001
- Total: 500 + 250 + 150 + 75 + 26 = 1,001 ✓

## Payment system — HATCHIEggy model, verified from source 2026-11-18
Reference: `~/workspace/hatchie/covenant-preview/contracts/contracts/HatchieGgyFactory.sol` (PRICE 0.001, MAX_PER_WALLET 10, BONUS_PER_PAID_MINT 120,000, MAX_BONUS_PER_WALLET 1,080,000, onlyAgent = msg.sender == tx.origin, NO registry check).
- **#1 FREE per wallet, #2–10 @ 0.0005 BNB flat** (user: "mulai dari 0,0005" — flat 0.0005, not the Nov-13 ladder)
- Max 10/wallet (1 free + 9 paid); max spend 0.0045 BNB/wallet
- Exact payment only; batch mint via priceFor(wallet, qty); first mint in a batch is free, rest paid
- **Gate: EOA-only (msg.sender == tx.origin), NO Agent ID registry check** — mirror HATCHIEggy. Page must NOT show a fake Agent ID checker; explain the EOA-only gate honestly in the mint panel.
- **Token $EYE: 1,000,000,000 total** — 540,000,000 pool held by token contract, 460,000,000 treasury to owner (BAW); **120,000 EYE per PAID mint**; max 1,080,000/wallet (9 paid × 120,000); free mint accrues 0
- Royalty **5% → BAW** (ERC-2981); owner + royalty receiver + mint revenue = **BAW 0x36F3D56eAD5D1D6C2434F94DeFcEF732C5C3CbD2**
- Marketplace: own escrow, 0% fee, royalty 5% → BAW (mirror `~/workspace/hatchieggy-market/contracts/contracts/HatchieggyMarketplace.sol`)

## Contracts (build only — NO deploy without explicit same-turn user order)
- BSC BEP-721, Hardhat 0.8.24, optimizer 200, cancun; CREATE2 proxy 0x4e59b44847b379578588920cA78FbF26c0B4956C salt 0; node_modules symlinked from ~/workspace/sonofluidic/contracts/node_modules
- Trio: EyeToken.sol ($EYE), EyeAgentNft.sol (sequential, HATCHIEggy-model), EyeAgentMarketplace.sol
- Tests must pass (Hardhat). Follow `~/workspace/custom-skills/nft_mint_launch/SKILL.md` (reread first) + AGENTS.md completeness rule.
- Metadata: 1,001 extensionless files `metadata/<id>` — {"name": "Eye Agent #<id>", "image": "https://eye-agent.vercel.app/assets/<slug>.jpg", "attributes": [{"trait_type":"Eye","value":"<Name>"},{"trait_type":"Tier","value":"<Tier>"}]}; tier counts verified 500/250/150/75/26.

## Page — COMPLETE from the start (completeness rule)
Hero (The Golden Gaze), live-status visual (progress ring + tier bars + live counts reading totalMinted on-chain), how-it-works, filterable gallery (8 eyes), rarity section + full ID table, special/mystery (The Golden Gaze, Mythic 26), mint panel with WORKING wallet flow + agent prompt copy + EOA-gate explainer + wallet display, token section, marketplace section, FAQ, details/contracts, footer/share, sticky-header Mint button, floating Mint button. Mobile-first, tidy, EN only, mint-open times in UTC only, NO Vercel/GitHub mentions on the page, no promised returns, no fake counts.
- Page in PREVIEW / not-deployed state until contracts deploy (addresses TBD — do not invent contract addresses).

## Status
- 2026-11-18: 8/8 artworks DONE. BRIEF written. Build delegated to subagent (contracts + metadata + page, local only — NO push, NO Vercel, NO deploy).
- OPEN: user confirmation of name Eye Agent / $EYE (delegated, can rename), X handle, language, Tweet to Mint + Presale choice (asked twice, unanswered — NOT part of this build unless he picks it).
- NEXT after build: parent creates GitHub repo (browser task) → push → Vercel project → verify live → ask user for explicit deploy + mint-open confirmation.
