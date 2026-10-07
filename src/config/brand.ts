// Single place to change project identity. Everything on the site reads from here.
// To publish the real contract address, replace the value of CA below. The
// navbar copy button, the footer, the phone dock, the swap page and every
// explorer link derive from it. Anything that is not a 0x + 40 hex address is
// treated as "not launched yet".

const CA = "0xxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
// Pair the chart button opens on DEXTools: the token's Pons curve while it trades
// there. After graduation, swap in the address of the pair DEXTools lists for the pool.
const CHART_PAIR = "";

export const isAddress = (v: string): v is `0x${string}` =>
  /^0x[0-9a-fA-F]{40}$/.test(v);

export const BRAND = {
  name: "FlowTenzor",
  ticker: "FLOWTENZOR",
  symbol: "$FLOWTENZOR",
  domain: "flowtenzor.com",
  url: "https://flowtenzor.com",
  slogan: "Intelligence Flows. Winners Rise.",
  tagline: "Real-time AI forecasts. Ranked live. Follow the winners flowing.",
  category: "AI forecasting platform",
  chainName: "Robinhood Chain",
  description:
    "FlowTenzor is an AI forecasting platform on Robinhood Chain. Models publish price ranges for stock tokens, each forecast is graded by Chainlink, and the ranking is public.",
  x: "https://x.com/flowtenzor",
  xHandle: "@flowtenzor",
  // Public source repository. Kept off the site until the owner publishes it.
  github: "https://github.com/",
  ca: CA,
} as const;

/** True once BRAND.github points at an actual repository, not the bare host. */
export const hasGithub = /^https:\/\/github\.com\/[^/]+/.test(BRAND.github);

// Public endpoints are the default. An operator can point the site at a
// private RPC with ROBINHOOD_RPC_URL (server) / NEXT_PUBLIC_ROBINHOOD_RPC_URL
// (browser). Both are optional.
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

export const CHAIN = {
  id: 4663,
  hex: "0x1237",
  name: "Robinhood Chain",
  nativeSymbol: "ETH",
  decimals: 18,
  publicRpc: PUBLIC_RPC,
  rpc: process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC,
  /** Second public endpoint, used for reads only when the first one fails. */
  fallbackRpc: "https://robinhood-rpc.publicnode.com",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

/** RPC for server code: the private endpoint when set, else the public one. */
export function serverRpc() {
  return (
    process.env.ROBINHOOD_RPC_URL ||
    process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ||
    PUBLIC_RPC
  );
}

export const TOKEN = {
  get isLive() {
    return isAddress(BRAND.ca);
  },
  get explorerUrl() {
    return isAddress(BRAND.ca) ? explorerToken(BRAND.ca) : null;
  },
  get chartUrl() {
    return isAddress(BRAND.ca) && isAddress(CHART_PAIR)
      ? `https://www.dextools.io/app/robinhood/pair-explorer/${CHART_PAIR}`
      : null;
  },
};

/**
 * Pons V2 launchpad and the Uniswap v4 contracts its graduated pools trade on.
 * Every address was checked with eth_getCode on Robinhood Chain mainnet.
 * The token trades on its Pons bonding curve until it graduates, then in a
 * v4 pool keyed (ETH, token, fee, tickSpacing, memeHook).
 */
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
  v4Quoter: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
  universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  /** Public launch page for a token. */
  page: (token: string) => `https://www.ponsfamily.com/launchpad/${token}`,
} as const;

export function explorerAddress(address: string) {
  return `${CHAIN.explorer}/address/${address}`;
}
export function explorerToken(address: string) {
  return `${CHAIN.explorer}/token/${address}`;
}
export function shortAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/**
 * USDG ("Global Dollar") on Robinhood Chain: the dollar API credits are paid in and paper follow is counted in.
 * Read on-chain on 7 Oct 2026: symbol USDG, 6 decimals. The site re-reads these values live; this is the fallback.
 */
export const USDG = {
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  symbol: "USDG",
  name: "Global Dollar",
  decimals: 6,
} as const;

export const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
