# Airdrop screen: tokenless protocols with traction (26 Oct 2026)

Data: DefiLlama API, pulled 26 Oct 2026 14:56 UTC (`/protocols`, `/lite/protocols2`, `/overview/fees` for fees and revenue, `/overview/dexs`). The raises and derivatives-volume endpoints are paywalled, so funding details come from news.

**Not financial advice.** Points are not tokens. Every "token planned" claim below comes from secondary sources unless it is marked as from the team.

## How the screen works

1. **Coverage:** 8,658 protocols. 3,931 have no token on the protocol or on its parent.
2. **Excluded categories:** CEXs, chains, bridges and canonical bridges, risk curators, RWA issuers, staking pools and card issuers. These are companies, not airdrop candidates.
3. **Ranking:** By TVL size, 30-day TVL change, 30-day fees, and age (a bonus for protocols listed in the last 12 months).
4. **Market baseline:** Total TVL across the protocols tracked is **−5.2% over 30 days** ($274.1B → $259.9B, with double counting). Anything growing beat the market.

Re-run:

```bash
tools/fetch_defillama.sh data
python3 tools/defillama_merge.py data
python3 tools/airdrop_screen.py data 5e6 score 60
```

## Shortlist

| # | Protocol | Chain | TVL | 30d TVL | Fees 30d (MoM) | Age | Points | Token |
|---|---|---|---|---|---|---|---|---|
| 1 | **Arcus Perps** | Robinhood Chain | $64.3M | **+179%** | $1.94M (**+385%**) | 108d | Season 1 live (Season 0 done) | Planned per secondary sources; rules unpublished |
| 2 | **BULK** | Solana | $8.3M | +4% | $0.44M (**+139%**) | 140d | AURA points | Founder: **30% of supply to community** |
| 3 | **Antarctic (AX)** | Arbitrum | $8.4M | −1% | **$2.37M** (−10%) | 340d | AX Points | Mainnet release: points "will be converted into AX tokens" |
| 4 | **Curvance** | Monad | $131.5M | +2% (**+29% 7d**) | $0.38M | 333d | Yes | CVE tokenomics published (59% gauge emissions); TGE overdue; Polymarket priced ~61% odds by end of 2026 |
| 5 | **infiniFi** | ETH, Monad, Base | $69.2M | **+37%** | $0.33M (+18%) | 516d | Boosted until TGE | TGE planned Q4 2026; seed led by Electric Capital |
| 6 | **Decibel** | Aptos | $29.3M | 0% | $0.54M (+6%) | 242d | Amps Season 1 | Token on roadmap; incubated by Aptos Labs |
| 7 | **Wildcat** | ETH, Plasma | $6.1M | **+49%** (+77% 7d) | $1.36M | 1060d | None found | No signal. $5.35M seed (Hyperithm) |
| 8 | **Loopscale** | Solana | $91.1M | +10% | $0.29M | 461d | Live | None announced |
| 9 | **Saturn (USDat)** | Ethereum | $156.7M | +9% | $1.09M (−42%) | 200d | Season 1 ended Aug; check for Season 2 | None announced; backed by YZi Labs and Sora |
| 10 | **Predict.fun** | BSC | $11.6M | +14% | **$7.72M** (+41%) | 776d | Live | "P" token teased 6 Oct; pre-market at $800M FDV. **Not hidden: priced in** |
| 11 | **Pacifica** | Solana | $24.2M (bridge) | n/a | n/a | n/a | Live | None announced |
| 12 | **Polymarket** | Polygon | $356.6M | +2% | $31.9M | n/a | n/a | Token and airdrop confirmed by Polymarket; mechanics unpublished. Not hidden |

### Notes per protocol

**1. Arcus** is the strongest tokenless setup in the data.
- Team: the dYdX founding team, with Robinhood Crypto as a backer.
- Product: perps (up to 50x) plus tokenized stocks on Robinhood Chain.
- Growth: TVL nearly tripled and fees grew almost 5x month over month while the market fell.
- Points: Season 1 just opened, so it is still early.
- Risks: geo-blocked in the US, UK and Canada. Points-to-token conversion is unconfirmed.

**2. BULK** is small in TVL but fees are accelerating.
- Funding: $8M seed.
- Allocation: the founder has said 30% goes to the community through airdrops, which is unusually high.
- Points: AURA accrues weekly on USDC held over time.
- Caveat: much of the coverage is referral-farming blogs, so check bulk.trade directly.

**3. Antarctic** earns $2.4M in fees a month on $8M of TVL, the best fees-to-TVL ratio on the list.
- Points: the clearest points-to-token statement found anywhere in this screen.
- Risk: the team is less well known. Volume may be wash-heavy because points are paid per $100 traded.

**4. Curvance** is a delayed-TGE bet.
- Tokenomics are fully published, and TVL jumped 29% this week.
- Seed terms were $68M FDV. If the token launches, the gap between the seed price and launch-time demand is the upside.

**5. infiniFi** is the only one with a dated TGE window (Q4 2026). TVL is up 37% in a down month, but $69M is still well under its $180M peak, so it is less crowded than it was. Late, but cheap to enter.

**6. Decibel** is incubated by Aptos Labs. Support from the Aptos ecosystem makes an incentive token likely, but timing is unknown.

**7–9. Wildcat, Loopscale and Saturn** are real businesses without a token. These are speculative bets that a token appears at all.

## Non-perps shortlist

Same screen, but derivatives and liquid staking are excluded (`python3 tools/airdrop_screen.py` with those categories added to `EX`).

| Protocol | Type, chain | TVL (30d) | Fees 30d (MoM) | Points / token status |
|---|---|---|---|---|
| **Tydro** + **Nado** | Lending (Aave V3 white-label) + spot DEX, Ink (Kraken's L2) | $133M (−3%) / $51M | $305k (**+38%**) | INK token **confirmed** by the Ink Foundation; it will be airdropped via Kraken Drops. A Tydro rep said points "represent claims on the first airdrop". Timing has slipped: Q2–Q3 2026 estimates, now late 2026 or 2027. Kraken's own *Ink Points* loyalty program is non-redeemable, so don't confuse the two |
| **CIAN Yield Layer** | Yield vaults, ETH/Mantle/Arbitrum | $314M (+4%) | $723k (**+52%**) | Voyage Points; token announced but not deployed |
| **infiniFi** | Yield, ETH/Monad/Base | $69M (**+37%**) | $332k (+18%) | TGE Q4 2026; boosted points |
| **Saturn** | STRC-backed stablecoin, ETH | $157M (+9%) | $1.1M (−42%) | Season 1 ended in Aug; check for Season 2. Backed by YZi Labs |
| **Curvance** | Lending, Monad | $131M (+29% 7d) | $382k | CVE tokenomics published; TGE overdue |
| **Current** | Lending, Sui | $56M (+6%) | $223k (**+30%**) | None found |
| **Aegis YUSD** | BTC-backed stablecoin, ETH/BSC | $34M (−1%) | $143k (**+255%**) | Aegis Points; 0.2% of AEG supply distributed weekly (per 2025 docs) |
| **Mellow** | Restaking vaults | $23M (−13%) | **$2.2M** (+23%) | Points for 2+ years and still no token. Farming fatigue |
| **Yuzu Money** | Stablecoin yield, Plasma/Monad | $78M (−1%) | $558k (+11%) | $YUZU referenced; status unclear |
| **Fluxion** | RWA spot DEX, Mantle | $7M (−2%) | $238k (**+149%**) | Fluxion Points paid via Mantle Vault; no token info |
| **Wildcat** | Uncollateralized credit, ETH/Plasma | $6M (**+49%**) | $1.4M | No program found |
| **Loopscale** | Lending, Solana | $91M (+10%) | $293k | Points live |
| **Fira** | Fixed-rate lending (Euler spin-out), ETH | $10M (**+35%**) | $36k | None found |
| **Flap.sh** | Memecoin launchpad, BSC + Robinhood Chain | $4M | **$31.2M** (−19%) | A 2024 airdrop ran; current token status unclear. Verify before farming |

Skipped:

| Protocol | Why |
|---|---|
| Temple | Institutional venue; no token |
| Gondi | Exploited Mar 2026; no program |
| Legion | A LEGION token already appears to exist |
| Stellar DeFi Hub | No fees |
| Symbiotic | −33% TVL |
| Bucket V2 | Bucket already has a token; DefiLlama's tagging looks incomplete |

## Solana and Robinhood Chain (high-volume chains)

30-day DEX volume from DefiLlama `/overview/dexs/{chain}`:

| Chain | 30d DEX volume | vs prior 30d |
|---|---|---|
| Solana | **$62.2B** | −22% |
| Ethereum | $37.1B | −14% |
| Robinhood Chain | **$29.8B** | −47% |
| Base | $29.0B | +8% |
| BSC | $27.1B | −24% |
| Hyperliquid L1 | $7.9B | −29% |

**Excluded: Solana prop AMMs.** BisonFi, Tessera V, GoonFi, Scorch, SolFi, ZeroFi, AlphaQ, Aquifer and QuantumAMM top the tokenless volume list, but they are private market-maker pools with no user base to airdrop to.

### Solana

| Protocol | What it is | Data | Points / token |
|---|---|---|---|
| **Axiom** | Trading terminal (Solana plus Robinhood Chain) | **$30.6M fees / 30d**; $2.3B Solana volume | Axiom Points plus SOL rewards live. No token confirmed; the founder reportedly said in early 2025 there were no plans |
| **Project 0** (ex-marginfi) | Lending / prime broker | $59M TVL; fees **+46%** MoM | **Token confirmed** (per MEXC). marginfi points carry over 1:1. TGE slipped past Q1 2026 |
| **Exponent** | Yield trading (Pendle-style) | $61M TVL (−12%) | Points Hub says points decide the TGE allocation. XPN contract reportedly finalized. $5M seed led by Multicoin |
| **Loopscale** | Lending | $91M TVL (**+10%**) | Points live |
| **Hylo** | Leveraged-SOL stablecoin | $38M TVL; $390k fees | XP points |
| **fomo** | Trading app | $15.8M fees; reportedly $94M raised | No points; referral fee-share only |
| **GMGN** | Trading terminal | $15.7M fees | Thin prediction markets price a 2026 token at about 11–23% |
| **BULK** (perps) | Perps | Fees +139% MoM | 30% of supply to community |

Skipped: Byreal (said "not launching a native token at this stage") and Manifest (zero-fee orderbook, no program).

### Robinhood Chain

Mostly memecoin-driven, and volume nearly halved month over month.

| Protocol | What it is | Data | Points / token |
|---|---|---|---|
| **Arcus** | Perps plus spot | See shortlist above | Season 1 points |
| **Flap.sh** | Launchpad | $31.2M fees / 30d | Ran a 2024 airdrop; current token status unverified |
| **Metric** | DEX, 14 days old | **$623M** RH volume / 30d | No info found yet. Earliest stage on the list |
| **Accountable** | Uncollateralized lending | $2.1M fees on $1.3M TVL (TVL +80%) | No info found |
| **Rialto** | Prop AMM | RH volume **+809%** | Prop AMM, likely no user airdrop |

Fables held its TGE on 20 Oct, so it is excluded.

## Theme worth watching: Robinhood Chain

Three of the highest-fee tokenless apps in the data run on Robinhood Chain:

| App | Type | 30d fees |
|---|---|---|
| Arcus | Perps | $1.9M |
| Fables | DEX | $4.0M |
| Snuggle | Liquidity manager | $1.2M |

- **Fables already held its token launch (TGE) on 20 Oct.** DefiLlama hasn't tagged its token yet, so it shows as tokenless in the data. Exclude it.
- Robinhood Chain has no network token. The bridge holds $617M, down 25% over 30 days.
- A new Robinhood Chain app with live points is the earliest-stage shape of this setup.

## Screened out

| Protocol | Why |
|---|---|
| Fables | TGE already happened (20 Oct) |
| Temple | Institutional venue on Canton; rewards paid in Canton Coin; no token |
| AZverse | DEX infrastructure / CeDeFi; no points program found |
| Extended | 30d TVL −3%, fees −31% MoM; points are 99% issued, so too late to farm |
| Project X | Pays USDC rewards; no token planned |
| Hyperliquid ecosystem (Felix, Hyperbeat) | Tokenless, but TVL is down 20–31% this month |

## Corrections to `2026-10-defi-tvl-gainers.md`

The earlier report was built from search snippets. API data corrects it:

| Protocol | Earlier report | API data |
|---|---|---|
| Fira | $450–850M TVL | **$10.1M** (+35% 30d) |
| Predict.fun | +46% 30d | **+14%** |
| Current | +41% 30d | **+6%** |
| Extended | (no change cited) | −3% 30d |
| Lighter bridge | (no change cited) | −6% 30d |

## Sources

- DefiLlama API (above); [DefiLlama airdrops list](https://defillama.com/airdrops)
- Arcus: [Cointelegraph launch](https://cointelegraph.com/news/robinhood-backed-dex-arcus-debut-multi-asset-trading), [Alea Research](https://www.alearesearch.io/newsletters/arcus-rwa-perps-on-robinhood-chain), [Bitrue points guide](https://www.bitrue.com/blog/arcus-airdrop-guide-earn-points-robinhood-chain)
- BULK: [Crypto Briefing](https://cryptobriefing.com/bulktrade-launches-solana-perps-exchange/), [CoinLaunch](https://coinlaunch.space/projects/bulk-trade/)
- Antarctic: [Bitcoinist mainnet / AX Points](https://bitcoinist.com/antarctic-exchange-mainnet-goes-live-earn-ax-points-and-shape-the-future-of-defi-trading/amp/), [airdrops.io](https://airdrops.io/antarctic/)
- Curvance: [CVE tokenomics docs](https://docs.curvance.com/cve/cve-token/tokenomics), [Lines prediction market](https://www.lines.com/prediction-markets/crypto/will-curvance-launch-a-token-by), [Olympus seed terms](https://forum.olympusdao.finance/d/1060-oip-81-curvance-seed-round)
- infiniFi: [KuCoin seed and Q4 TGE](https://www.kucoin.com/blog/infinifi-3m-seed-funding-electric-capital?lang=en_US)
- Decibel: [The Defiant](https://thedefiant.io/news/defi/decibel-perpetuals-exchange-launches-on-aptos), [Incrypted](https://incrypted.com/en/decibel-trade/)
- Wildcat: [Techleap: Hyperithm seed](https://finder.techleap.nl/news/feed/hyperithm-invests-3-5m-in-wildcat-finance), [Cryptorank](https://cryptorank.io/ico/wildcat-labs)
- Loopscale: [Nasdaq: DFDV LOI](https://www.nasdaq.com/press-release/defi-development-corp-signs-loi-loopscale-boost-stablecoin-sol-yield-and-participate)
- Saturn: [The Block](https://www.theblock.co/post/385808/saturn-raises-800k-from-yzi-labs-and-sora-ventures-to-build-usdat-a-11-yield-bearing-stablecoin-protocol-backed-by-michael-saylors-digital-credit), [Cryptorank](https://cryptorank.io/drophunting/saturn-protocol-activity1153)
- Predict.fun: [Bitrue token launch](https://www.bitrue.com/blog/predict-fun-token-launch), [CoinGabbar pre-market](https://www.coingabbar.com/en/predictfun-token-pre-market-goes-live-fdv-details)
- Fables: [Bitrue: FABLES TGE](https://www.bitrue.com/blog/fables-tge)
- Temple: [Crypto Briefing](https://cryptobriefing.com/temple-token-terminal-canton-network/)
- Perps points overview: [Derive](https://blog.derive.xyz/perpetual-dex-airdrop-and-points-program-list)
