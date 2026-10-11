// FlowTenzor contracts on Robinhood Chain: the one place their addresses live.
//
// While an address is empty, the matching feature keeps running in practice
// mode (free signatures, nothing moves on chain). After the owner deploys from
// /deploy, paste the address and block it prints below and push: the same
// screens then read the contract and send real transactions through the
// connected wallet.
//
//   ForecastOracle  no token needed: can be deployed now.
//   CallCredits     no token needed: needs the treasury address.
//   ModelBond       needs the $FLOWTENZOR contract address (deploy after the CA exists).
//
// The NEXT_PUBLIC_* variables are only a fallback for local test builds against
// a devnet or a fork. Leave them unset in production.

const ORACLE = "0x6e12dfdc445e746d830b74bb36bfe9b507669f0f";
const ORACLE_BLOCK = 83277338;
const CREDITS = "0x7ca43c78930915a9eddf8cdf17fe63c28887d460";
const CREDITS_BLOCK = 83277882;
const BOND = "";
const BOND_BLOCK = 0;

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
const pick = (fixed: string, env: string | undefined) => (isAddr(fixed) ? fixed : env && isAddr(env) ? env : "");
const pickBlock = (fixed: number, env: string | undefined) => fixed || (env && /^\d+$/.test(env) ? Number(env) : 0);

export const CONTRACTS = {
  oracle: {
    name: "ForecastOracle",
    address: pick(ORACLE, process.env.NEXT_PUBLIC_ORACLE_CONTRACT),
    block: pickBlock(ORACLE_BLOCK, process.env.NEXT_PUBLIC_ORACLE_BLOCK),
  },
  credits: {
    name: "CallCredits",
    address: pick(CREDITS, process.env.NEXT_PUBLIC_CREDITS_CONTRACT),
    block: pickBlock(CREDITS_BLOCK, process.env.NEXT_PUBLIC_CREDITS_BLOCK),
  },
  bond: {
    name: "ModelBond",
    address: pick(BOND, process.env.NEXT_PUBLIC_BOND_CONTRACT),
    block: pickBlock(BOND_BLOCK, process.env.NEXT_PUBLIC_BOND_BLOCK),
  },
} as const;

export type ContractKey = keyof typeof CONTRACTS;

export const oracleLive = () => CONTRACTS.oracle.address !== "";
export const creditsLive = () => CONTRACTS.credits.address !== "";
export const bondLive = () => CONTRACTS.bond.address !== "";

/** Deployment parameters, shown on /deploy and checked by scripts/verify-deployment.mjs. */
export const DEPLOY = {
  /** Seconds a feed answer may be old when a forecast is committed (covers a weekend plus a heartbeat). */
  maxReferenceAge: 4 * 24 * 3600,
  /** API: calls per pack and price per pack in USDG base units (6 decimals). 1,000 calls for 1 USDG. */
  callsPerPack: 1000,
  packPrice: 1_000_000,
  /** Model bond: amount in token base units (18 decimals assumed for a Pons token) and the exit delay. */
  bondAmount: "1000000000000000000000000", // 1,000,000 $FLOWTENZOR
  exitDelay: 7 * 24 * 3600,
} as const;

/** Oracle forecast status codes, in Solidity order. */
export const FORECAST_STATUS = ["none", "open", "scored", "void"] as const;
