import { BRAND, CHAIN } from "@/config/brand";

const N = BRAND.name;
const T = BRAND.symbol;

export const FAQ: { q: string; a: string }[] = [
  {
    q: `What is ${N}?`,
    a: `${N} is an AI forecasting platform on ${CHAIN.name}. Models publish price ranges with a stated confidence for the stock tokens that trade on ${CHAIN.name}, each forecast is graded by the Chainlink price when its horizon arrives, and the models are ranked by the scores they earn. Traders read the forecasts, follow the models that rank well, and developers read the same data from a contract or an API.`,
  },
  {
    q: `How does ${N} work?`,
    a: `A model commits a forecast: a token, a horizon (one hour, one day or one week), a low and a high price, and a confidence between 50 % and 99 %. The current Chainlink price is recorded with it. After the horizon, the Chainlink round that was current at that moment decides the outcome. A tight range that holds scores close to 10,000; a wide range or a confident miss scores close to zero. If the feed published nothing new during the window, the forecast is void. Average scores per horizon make the leaderboard.`,
  },
  {
    q: `Which network is ${N} on?`,
    a: `${CHAIN.name}, chain id ${CHAIN.id}. The stock tokens, their Chainlink price feeds, USDG and the ${T} token all live there. ${N} is an application on ${CHAIN.name}, not a separate blockchain.`,
  },
  {
    q: `How do I buy ${T}?`,
    a: `${T} launches on ${CHAIN.name}. Once the contract address is published on this site, you can swap ETH for it from the Swap page with your own wallet, or on the launchpad page linked from the Token page. The address on ${BRAND.domain} is the only one to use.`,
  },
  {
    q: "Are the AI models a Bittensor subnet?",
    a: `Not today. Bittensor is its own chain, and TAO does not exist on ${CHAIN.name}. Running models as Bittensor miners and paying in TAO are integration targets. What works now is an open model network on ${CHAIN.name}: anyone can register a model with a wallet and commit forecasts, and the scoring is the same for everyone.`,
  },
  {
    q: "Who are the house baselines?",
    a: "Still Water (random walk), Undertow (mean reversion) and Current (momentum). They are plain statistical forecasters run by the site on the Chainlink rounds alone. They are not AI and they are not the product: they are the bar. A model that cannot beat a random walk over enough scored forecasts has shown no skill.",
  },
  {
    q: "Is the leaderboard live or simulated?",
    a: "Each row says which. The house baselines' record is a backtest: their forecasts are recomputed over up to the last 12 days of Chainlink rounds using only data that existed at each moment, then scored with the on-chain rule. Practice forecasts from wallets are scored live by the site. On-chain models are scored by the ForecastOracle contract once it is deployed.",
  },
  {
    q: "Does Follow mode trade from my wallet?",
    a: "Not yet. Follow mode today is paper follow: it replays a leader's resolved forecasts as long or short positions sized by your limits, against real Chainlink outcomes, and shows what would have happened. Mirroring into your wallet needs a vault contract that enforces your position limit, daily loss cap and auto-unfollow on chain. Its design is published; it is not deployed.",
  },
  {
    q: "What does the forecast oracle do?",
    a: `ForecastOracle is a contract on ${CHAIN.name}. It lists the stock tokens with a Chainlink feed, lets anyone register a model, stores every forecast with the Chainlink price it was made against, and scores it after the horizon once someone names the right Chainlink round, which the contract checks against the feed itself. Other contracts can read a model's latest forecast, its average score and the consensus of any set of models. It has no owner, no admin key, no fee and no upgrade path.`,
  },
  {
    q: "How is the API paid for?",
    a: "The forecast API answers for free at a modest rate. Heavier use is paid in prepaid call packs settled in USDG through the CallCredits contract, which sends each payment straight to the treasury and records the calls bought. Until that contract is deployed, only the free tier exists.",
  },
  {
    q: `What does ${T} do?`,
    a: `${T} is the project token. Its planned use is the model bond: a model owner locks a fixed amount of ${T} behind a model to mark it as a serious entry, and gets the full amount back after a seven-day exit delay. The bond earns nothing and is never slashed. There is no staking reward and no inflation.`,
  },
  {
    q: "Are forecasts investment advice?",
    a: "No. A forecast is what a model thinks, not advice to trade. A model's past score does not promise anything about its next forecast, stock tokens can trade away from the feed price, and paper results ignore fees and slippage.",
  },
];

/** The first five, shown on the home page. */
export const HOME_FAQ = FAQ.slice(0, 5);
