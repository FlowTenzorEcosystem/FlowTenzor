# FlowTenzor — Real-time AI forecasts. Ranked live. Follow the winners flowing.

FlowTenzor is an AI forecasting platform on Robinhood Chain. Models publish a price range and a confidence for every stock token on the chain, every forecast is scored against the Chainlink price when its horizon arrives, and the models are ranked by the scores they earn.

Website: https://flowtenzor.com · X: https://x.com/flowtenzorcom

## The problem

Trading tools that call themselves AI usually give you one opinion from one model you cannot inspect, with a hit rate nobody can rebuild. The losing calls are not on the page, the period was chosen after the fact, and there is nothing to compare the model with.

## The solution

Many independent forecasters predict the same tokens over the same horizons. Each forecast is fixed before its outcome exists, with the Chainlink price it was made against recorded next to it. When the horizon passes, the Chainlink round that was current at that moment decides the score, by one public rule. Misses are scored as plainly as hits, so a ranking is something a model earns, not something it claims.

## How it works

- **Forecast**: a token, a horizon (1 hour, 1 day or 1 week), a low, a high and a confidence from 50 % to 99 %.
- **Score**: an interval score. `interval = (high - low) + 2 x miss / (1 - confidence)`, relative to the reference price, against a budget of 2 % / 6 % / 15 % per horizon; `score = 10,000 x (1 - relative / budget)`, floored at 0.
- **Void**: if the feed published no new round during the window (closed market, quiet feed), the forecast is void and not scored.
- **Rank**: average score per horizon, with the number of scored forecasts beside it (five needed for a rank).
- **Consensus / divergence**: three in four of at least three live forecasters lean one way, or their centres disagree by more than half their own range width.
- **Follow**: paper follow replays a leader's forecasts under your own stake, loss-per-trade, daily-loss and auto-unfollow limits.

The same rule runs in the `ForecastOracle` contract and in the site's code (`src/lib/forecast/scoring.ts`), with shared test vectors.

## What you can try

Live now:
- Forecast feed for 36 Robinhood stock tokens with live Chainlink prices and four house baselines (random walk, fast volatility, mean reversion, momentum) whose record is replayed from the Chainlink rounds.
- Practice forecasts: sign a forecast with your wallet for free (no transaction); it is stored and scored with the oracle's rule.
- Leaderboard, model battle, paper follow, research console (rule-based answers from live data), market pages with listing charts, on-chain pool quotes, pulse, news, analytics, macro calendar, portfolio, alerts.
- Forecast API free tier: `GET /api/v1/forecasts?symbol=NVDA&horizon=1d`.

Coming later:
- `ForecastOracle` and `CallCredits` on mainnet (written and tested here; every screen switches to them when their addresses are set).
- `ModelBond`, after the `$FLOWTENZOR` token launches.
- A follow vault that mirrors trades into your wallet with your limits enforced on chain (design only).
- A Bittensor subnet as a source of models. Bittensor is a separate chain and TAO does not exist on Robinhood Chain; this is an integration target, not a live service.

Forecasts are model outputs, not investment advice.

## Run it locally

Requirements: Node.js 20 or newer. Download the ZIP of this repository (or fork it), then:

```
npm install
npm run build
npm start            # http://localhost:4940
```

Environment variables are all optional; without them the site uses the public Robinhood Chain RPC and keeps practice data in a local `.practice-data.json`. Copy `.env.example` to `.env.local` and fill in only what you use:

| Variable | Use |
|---|---|
| `ROBINHOOD_RPC_URL` / `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Private RPC (server / browser), e.g. from Alchemy. Empty = public RPC. |
| `CHAINLINK_HISTORY_RPC_URL` | Separate endpoint for the heavy feed-history reads. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect project id (cloud.reown.com). Without it WalletConnect shows "not configured". |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or `KV_REDIS_URL` / `REDIS_URL`) | Storage for practice forecasts, API keys and rate limits. Required on Vercel for those features; use a `noeviction` (or `volatile-*`) policy because API accounts carry no expiry. |
| `STORE_KEY_PREFIX` | Key prefix when several projects share one Redis. |
| `TRUST_PROXY_HEADERS`, `TRUSTED_PROXY_HOPS`, `CLIENT_IP_HEADER` | How to read the client IP behind your own proxy (Vercel is detected). |
| `ALLOW_LOCALHOST_SIGNIN` | Local testing only: `1` lets a local production build sign messages for localhost. Never set it on a public server. |

On Vercel: Project → Settings → Environment Variables, then redeploy.

Tests: `npm test` (site), `cd contracts && ./setup.sh && forge test` (contracts).

## Network

Robinhood Chain mainnet, chain id 4663 (0x1237), native gas ETH, RPC `https://rpc.mainnet.chain.robinhood.com`, explorer https://robinhoodchain.blockscout.com. The wallet dialog adds the network to your wallet when you connect.

## Project layout

```
src/app/(site)        landing, docs, terms, privacy, owner deploy page
src/app/(app)         app screens (ask, markets, pulse, tokens, arena, battle, forecasts, leaderboard, follow, ...)
src/app/api           read relay, board, practice tickets, API v1, hints, quotes, series, portfolio
src/lib/forecast      scoring rule, Chainlink history, house baselines, board, consensus
src/lib/practice      signed practice forecasts, API keys and paid-call accounting
src/lib/onchain       ABI encoding, contract reads and transactions
src/config            brand, stock tokens and feeds, contract addresses
contracts/            Foundry project: ForecastOracle, CallCredits, ModelBond and their tests
keeper/               optional bot that scores due forecasts
sdk/                  read-only agent SDK and an example agent
scripts/              verify-deployment, verify-stocks, contract bytecode export, API account tool
```

## Contracts and token

| Contract | Constructor | Notes |
|---|---|---|
| `ForecastOracle` | 36 Chainlink feeds + symbols (order of `src/config/stocks.ts`), max reference age 4 days | Records and scores forecasts. No owner, admin key, fee, pause or upgrade. Needs no token. |
| `CallCredits` | USDG, treasury, 1,000 calls per pack, 1 USDG per pack | Payments go straight to the treasury. No owner. |
| `ModelBond` | `$FLOWTENZOR`, oracle, 1,000,000 tokens, 7-day exit delay | Refundable bond per model; never slashed, earns nothing. Deployed after the token exists. |

Addresses (empty until deployed) live in `src/config/contracts.ts`. To check a deployment against this source:

```
cd contracts && ./setup.sh && forge build --force && cd ..
npm run verify-deployment -- <address> --tx <creation tx hash> [--treasury <address>]
```

Source verification on Blockscout: Solidity standard JSON from `forge verify-contract --show-standard-json-input`, compiler 0.8.24, optimizer 200 runs, via-IR, EVM paris, no metadata hash.

The keeper (`keeper/`, Docker) calls `scoreMany` for due forecasts; `score` is permissionless, so the keeper holds no power and only pays gas. Agents read the oracle with `sdk/flowtenzor.mjs`.

`$FLOWTENZOR` is the project token on Robinhood Chain. Its contract address is published on the site's token page at launch; trust no other source.

## Security and status

- The contracts are written and tested (unit, fuzz, invariant and mainnet-fork tests) and are not deployed yet.
- Every request body is read with a size cap, the browser read relay only serves known contracts and read methods, server RPC answers are capped, and every write endpoint is rate limited per network and per wallet.
- Wallet signatures name this site's own domain, never one taken from the request.
- Paid-call accounting fails closed: a lost record or an unreadable chain never grants calls.

## Contributing

Issues and pull requests are welcome. Please keep changes small, run `npm test`, `npx tsc --noEmit`, `npx eslint` and the Foundry tests, and describe what you checked.

## License

MIT, see `LICENSE`.
