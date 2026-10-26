# DeFi TVL gainers: late Sep to late Oct 2026

Snapshot date: 26 Oct 2026. Window: about 30 days (late Sep to late Oct).

## Read this first: data limits

- **I could not query DefiLlama directly.** This environment's network policy blocks `api.llama.fi` and `defillama.com`. Every figure below comes from DefiLlama protocol pages as indexed by web search (snapshots dated 14–26 Oct), daily DeFi tracker reports on GitHub that cite DefiLlama, and news coverage.
- **This is not a full ranking.** I checked about 40 of the largest and most-discussed protocols. A smaller protocol that grew a lot may be missing. To get the full list, run the API query in the appendix once `api.llama.fi` is allowed.
- **Snapshots disagree.** Where two DefiLlama views gave different numbers, both are shown.

## 1. Baseline: a falling month

| Market | Change (≈25 Sep → 26 Oct) |
|---|---|
| ETH | $2,691 → $2,306 (**−14%**) |
| BTC | $84.6k → $79.6k (**−6%**) |
| USDC supply | $76.4B → $71.7B (**−6%**) |
| USDT supply | $183.7B → $182.3B (−1%) |
| Total DeFi TVL | about $88–90B, roughly flat week over week, about 21% below its January level |

Most large protocols lost TVL over the 30 days:

| Protocol | TVL | 30d |
|---|---|---|
| Lido | $22.4B | **−15%** |
| Aave (all versions) | $17.6B | **−8.9%** |
| Hyperliquid (bridge) | $8.2B | −9% |
| Spark | $6.9B | −5% (protocol page) / −30% (homepage view) |
| Sky | $5.6B | −8% |
| Ethena | $5.0B | −6.2% |
| ether.fi | $4.5–4.8B | −20% |
| Babylon | $3.3B | −4% |
| Maple | $2.6B | −12% |
| Sanctum | $2.05B | −6.8% |
| Jupiter | $1.76B | −11.3% |
| Kamino | $1.34B | −9.4% |
| Pendle | $1.07B | **−18.4%** |
| Kinetiq | $0.94B | **−29%** |
| HyperLend | $0.30B | −28% |
| Felix | $0.06B | −34% |

**So "gaining against others" this month means flat or up while the field fell 5–30%.**

A large part of the gap comes from what each protocol holds. With ETH down 14%, any protocol whose TVL is mostly ETH or LSTs (Lido, ether.fi, Pendle, Hyperliquid-ecosystem LSTs) loses dollar TVL even with zero withdrawals. Protocols that hold mostly stablecoins (Morpho USDC vaults, Arc, RWA lenders) look strong by default. Read every relative gain below with that in mind.

## 2. Protocols that grew against the market

### Tier 1: real, large-scale gains

#### Morpho (lending): $11.3B, +2.8% to +3.2% over 30d
Aave fell 8.9% in the same window, so Morpho beat it by about 12 points.

- **Why it's gaining:**
  - Its curator-vault model keeps winning B2B distribution. Coinbase's USDC lending runs on Morpho, Bitwise launched non-custodial vaults on it, and institutional curators (Steakhouse, Sentora, Galaxy, Keyrock, Gauntlet) are building on it.
  - It is the largest protocol on Circle's new Arc chain, at about $299M.
  - Galaxy Curation (+254% in a week, mid-Oct) and Keyrock (+1,000%) both curate on Morpho V2. Curator TVL growth is Morpho TVL growth.
  - Its book is stablecoin-heavy, so the ETH drawdown hurt it less.
- **PMF:** Strong. Morpho is the default back end when a company wants to offer on-chain lending under its own brand. It held about 46% of all curated-vault capital earlier this year and gained share from Aave after the April KelpDAO stress event.
- **Moat:** Medium-high. The moat is integrations and curators, not liquidity:
  - Switching costs sit at the distributor (Coinbase, Bitwise).
  - Immutable isolated markets let curators take risk without governance votes.
- **Risks:**
  - Curators can redeploy to Euler or Aave V4.
  - Vault runs are real. Sentora saw outflows after the 30 Sep MetaMask staking incident, and curated vaults saw a redemption wave after the Nov 2025 xUSD depeg.
  - Fees are about 4x lower than Aave's.
- **Token:** MORPHO is live. Morpho raised $175M from a16z and Paradigm in Jun 2026 at a valuation above $2B.
- **Points:** None.

#### Arc (Circle's L1) ecosystem: about $629M TVL, +18% in a week (mainnet launched 16 Sep)
This is the fastest-growing venue of the month. It is new money only in part:

| Arc protocol | TVL on Arc |
|---|---|
| Morpho Blue | ~$299M |
| Aave V4 | ~$177M |
| Extended (perps) | ~$113M |
| Galaxy Curation | ~$95M |
| Uniswap | ~$29M |

- **Why it's gaining:**
  - Circle's distribution: USDC is native, gas is paid in stablecoins, and BlackRock and Visa are among the validators.
  - Blue-chip DeFi deployed on day one.
  - **Some of the TVL moved chains rather than arriving fresh.** Extended moved its settlement from Starknet to Arc on 22 Oct, and its USDT and wBTC users were pushed to convert to USDC or cirBTC.
- **PMF:** Unproven. Arc had earned under $100k in revenue since launch as of late Sep, which points to seeded or institutional parking liquidity rather than organic demand so far.
- **Moat:** Circle owns the issuer, the chain, and the distribution. If Circle routes institutional USDC flows to Arc, that is a structural advantage no other L1 has.
- **Token:**
  - Circle completed the genesis mint of 10B ARC. A public token launch is still undecided.
  - Third-party explainers report a private sale of 740M ARC at $0.30 (about $222M) in May 2026. I could not verify this against Circle's filings.
  - The token is planned for governance, incentives, and an eventual move to proof of stake.
- **Points:** **Arc House** is a points-and-badges program. Circle has not committed to any link between points and a token. **This is the clearest "token planned plus points running" setup among the large movers.**

#### Aave V4: about $667M across chains (about $456M Ethereum, $181M Arc)
- **Why it's gaining:** It is a new deployment (hub-and-spoke design, Forex Spoke for stablecoin FX borrowing) and is live on Arc from day one. Caps are deliberately conservative and step up on LlamaRisk sign-off, so TVL grows as caps rise.
- **Caveat:** Much of this TVL comes from existing Aave V3 users rather than new users, since Aave in total fell 8.9%.
- **PMF and moat:** Aave's brand, liquidity, and fee lead (about $46M in 30d fees vs about $11M for Morpho) are still the strongest in lending.
- **Token:** AAVE is live.
- **Points:** None.

#### Uniswap: $4.1B, +2.3% over 30d
- **Why it's gaining:** BNB Chain. Uniswap's BSC TVL reached about $437M, up 213% in 30 days and 104% in 7 days. I found no confirmed cause. Uniswap's governance has also proposed extending its protocol fee to Arc. In a down month, flat-to-up for the largest DEX means it gained relative to the field.
- **Moat:** High. It has liquidity depth, aggregator routing, and the V4 hooks platform.
- **Token:** UNI is live.
- **Points:** None.

### Tier 2: mid-size, growth claims worth checking

#### Lighter (perp DEX): about $815M, +9% over 30d (protocol page)
- **Conflict:** The bridge-only page shows about $602M, down from $650–670M in early Oct. Treat this as roughly flat.
- **Why it's holding:** Zero-fee trading, ZK-verified matching, and **ongoing points**. 25% of LIT supply is reserved for future points programs, so farmers keep depositing.
- **Moat:** Weak against Hyperliquid. Zero fees can be copied, and TVL is down from its $1.46B all-time high in Dec 2025.
- **Token:** LIT launched in Dec 2025 with a 25% airdrop.
- **Points:** Live.

#### Falcon Finance (synthetic dollar USDf): $1.44B, +19% in 7d (3 Oct sample)
I could not confirm the 30-day figure.
- **Why it's gaining:** A universal-collateral stablecoin with backing above 100% (111% in July). It took share as Ethena's TVL fell 6%.
- **Token:** FF is live.
- **Points:** The Falcon Miles program ran through 2025. I could not confirm whether it is still active.

#### Extended (perp DEX, now settling on Arc): about $113–125M
- **Why it's interesting:** The migration to Arc plus integrated lending and spot are on its roadmap.
- **Points:** In their **final stage**: about 69.2M of a 70M cap had been issued as of mid-Oct, at 600k per week. A TGE looks close.
- **Token:** Planned. The team has said about 30% of supply goes to the early community (points holders), with buybacks funded from accumulated revenue starting at TGE.
- **Risk:** In August the team cut some accounts' points, which shows it has broad discretion over point rules.

### Tier 3: small caps with large percentage moves (high noise)

| Protocol | TVL | Move | Token | Points |
|---|---|---|---|---|
| Current (Sui lending) | ~$58M | **+41% 30d**, all-time high on 7 Oct | Not found | Not found |
| Predict.fun (BSC prediction market) | ~$14.7M | **+46% 30d** | **None yet**. The founder reportedly said TGE is "weeks, not months" (date of that statement unverified) | **Live** |
| Wildcat (undercollateralized credit) | ~$14.5M | **+381% 7d** (25 Oct) | Not found | Not found |
| 3Jane (credit, USD3/sUSD3) | ~$30M | +143% 7d (29 Sep) | JANE is distributed via liquidity mining but locked until the final mint in 2026 | Liquidity mining live |
| infiniFi (on-chain dollar yield) | ~$50M (ATH $180M) | Recovering | **TGE planned for Q4 2026**. Raised a $3M seed led by Electric Capital on 23 Sep | **Boosted points run through TGE** |
| Fira (fixed-rate lending, Euler spin-out) | ~$450–850M | +23% in 1d (26 Oct) | Not found | Not found |

## 3. Token status at a glance

| Protocol | Token out? | Token planned? | Points running? | Note |
|---|---|---|---|---|
| Morpho | ✅ MORPHO | – | ❌ | Grows without incentives. Strongest PMF signal |
| Aave V4 | ✅ AAVE | – | ❌ | |
| Uniswap | ✅ UNI | – | ❌ | |
| Arc (chain) | ⚠️ Minted, not public | ✅ ARC (governance, incentives, PoS) | ✅ Arc House | **Main token-plus-points setup** |
| Extended | ❌ | ✅ ~30% to community, buybacks at TGE | ✅ Final stage | **TGE looks close** |
| Lighter | ✅ LIT | – | ✅ 25% of supply reserved | Points-driven retention |
| Falcon | ✅ FF | – | ? | |
| Predict.fun | ❌ | ✅ (TGE timing unverified) | ✅ | |
| infiniFi | ❌ | ✅ Q4 2026 | ✅ Boosted to TGE | |
| 3Jane | ⚠️ Locked JANE | ✅ Final mint 2026 | ✅ Liquidity mining | |

## 4. Takeaways

1. **Organic winner: Morpho.** It grew 3% while Aave fell 9%, with no points and a live token. Growth came through curators and B2B integrations, which is the best PMF signal in this set. The main risk is that its liquidity is concentrated in a few curators, and those can run.
2. **Biggest new money: Arc.** It is Circle-sponsored, it has a planned token, and it runs a points program. Expect TVL to stay high until the ARC token or incentive design is clear, but low revenue says the demand is not organic yet. Some of its growth (Extended) moved over from Starknet.
3. **Points-driven: Lighter, Extended, Predict.fun, infiniFi, 3Jane.** Their TVL depends on incentives. Past points-to-TGE cycles (EigenLayer, Ethena, Lighter's own drop from its Dec 2025 high) suggest TVL usually peaks near the final snapshot or TGE and then falls. Extended and infiniFi are both near that point.
4. **Losers are mostly ETH-price exposure.** Lido, ether.fi, Pendle, and Kinetiq fell 15–30%. That is mostly the 14% ETH drop plus the end of points programs (Hyperliquid LSTs), not lost PMF.

## Appendix: re-run with the full API once DefiLlama is allowed

```bash
curl -s https://api.llama.fi/protocols | jq -r '
  map(select(.tvl >= 1e8 and .change_1m != null and (.category|IN("CEX","Chain")|not)))
  | map(. + {gain: (.tvl - .tvl/(1+.change_1m/100))})
  | sort_by(-.gain)[:40][]
  | [.name, .category, (.tvl/1e6|floor), (.change_1m*10|round/10), (.gain/1e6|floor), (.symbol // "-")] | @tsv'
```

## Sources

- DefiLlama protocol pages (snapshots 14–26 Oct 2026):
  - Lending, staking, stablecoins, perps: [Aave](https://defillama.com/protocol/aave), [Morpho](https://defillama.com/protocol/morpho), [Morpho Blue](https://defillama.com/protocol/morpho-blue), [Spark](https://defillama.com/protocol/spark), [Pendle](https://defillama.com/protocol/pendle), [Lido](https://defillama.com/protocol/lido), [ether.fi](https://defillama.com/protocol/ether.fi), [Ethena](https://defillama.com/protocol/ethena), [Hyperliquid](https://defillama.com/protocol/hyperliquid), [Kinetiq](https://defillama.com/protocol/kinetiq), [HyperLend](https://defillama.com/protocol/hyperlend), [Felix](https://defillama.com/protocol/felix), [Lighter](https://defillama.com/protocol/lighter), [Lighter Bridge](https://defillama.com/protocol/lighter-bridge), [Aster](https://defillama.com/protocol/aster), [Extended](https://defillama.com/protocol/extended)
  - Solana and Sui: [Jupiter](https://defillama.com/protocol/jupiter), [Kamino](https://defillama.com/protocol/kamino), [Sanctum](https://defillama.com/protocol/sanctum), [Current](https://defillama.com/protocol/current)
  - DEXs, new deployments, prediction markets: [Uniswap](https://defillama.com/protocol/uniswap), [Aave V4](https://defillama.com/protocol/aave-v4?fees=false), [Arc chain](https://defillama.com/chain/arc), [Predict Fun](https://defillama.com/protocol/predict-fun)
  - RWA: [RWA dashboard](https://defillama.com/rwa)
- Daily DefiLlama-derived trackers: [defi-radar #227](https://github.com/AriaYD/defi-radar/issues/227), [#226](https://github.com/AriaYD/defi-radar/issues/226), and issues #196, #200, #204, #211, #216; [market-intel 26 Oct](https://github.com/Ricosworks1/market-intelligence-reports/releases/tag/market-intel-defi-tvl-concentration-fee-flows-20261026)
- Arc:
  - [The Block: Arc mainnet and 10B ARC mint](https://www.theblock.co/news/ecosystems/2026-09-16-circle-launches-arc-mainnet-blackrock-and-visa-among-validators-mints-10-billion-arc-tokens-415250)
  - [The Defiant: Arc token plans](https://thedefiant.io/news/defi/circle-reveals-plans-for-native-arc-token)
  - [RootData: Arc TVL $494M](https://www.rootdata.com/news/770515)
  - [Bitcoinist: Aave V4 on Arc](https://bitcoinist.com/aave-v4-goes-live-on-arc-with-usdc-eurc-cirbtc-and-weth/amp/)
  - [Aave governance: deploy V4 on Arc](https://governance.aave.com/t/arfc-deploy-aave-v4-on-arc/25170)
- Extended:
  - [Crypto Briefing: settlement move to Arc](https://cryptobriefing.com/extended-migrates-settlement-starknet-to-arc/)
  - [Blockworks: Extended migration](https://blockworks.com/news/perp-dex-extended-starknet-migration)
  - [WEEX: perp DEX points analysis](https://www.weex.com/news/detail/after-standxs-exit-reviewing-9-potential-opportunities-in-the-perp-dex-space-fvct5igwgt9f19mo6s4srrk8)
- Morpho:
  - [CoinEx: Morpho share-gain analysis](https://www.coinex.com/en/insight/report/morpho-analysis-is-morphos-lending-share-gain-a-shortterm-catalyst-or-longterm-support-69fabd682b42a1f0b2497e16)
  - [CoinTurk: curated vaults](https://en.coin-turk.com/morpho-leads-11-3-billion-curated-defi-vaults-as-top-5-managers-control-69yuzde/)
  - [Crypto Briefing: Sentora outflows](https://cryptobriefing.com/sentora-morpho-vaults-outflows-metamask-incident/)
- Lighter: [crypto.news: LIT launch](https://crypto.news/lighter-dex-launches-lit-token-airdop-2025/)
- infiniFi: [KuCoin: seed round and Q4 TGE](https://www.kucoin.com/blog/infinifi-3m-seed-funding-electric-capital?lang=en_US)
- Predict.fun: [Bitrue airdrop guide](https://www.bitrue.com/blog/predict-fun-airdrop), [Odaily](https://www.odaily.news/en/post/5213277)
- 3Jane: [AICoin: JANE liquidity mining](https://www.aicoin.com/en/news-flash/2930268)
- Fira: [Cointelegraph: fixed-rate lending launch](https://cointelegraph.com/news/fira-fixed-rate-defi-lending-450m-deposits)
- Uniswap on BSC: [ChainCatcher](https://www.chaincatcher.com/en/article/2297556)
- Market context: [TokenPost: weekly DeFi TVL](https://www.tokenpost.com/news/investing/38922), [Inside Deep Tech: Q3 2026 DeFi report](https://www.insidedeeptech.com/defi-industry-report-q3-2026/)
