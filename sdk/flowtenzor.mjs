// FlowTenzor agent SDK: read scored forecasts from the ForecastOracle contract on Robinhood Chain.
// No dependencies (Node 18+ or a browser). Read-only: it never signs or sends a transaction.
//
//   import { FlowTenzor } from "./sdk/flowtenzor.mjs";
//   const ft = new FlowTenzor({ oracle: "0x…" });
//   const c = await ft.consensus("NVDA", "1d", [1n, 2n, 3n]);
//
// Markets are listed in the oracle in the order of src/config/stocks.ts; ft.marketId() reads them from the chain.

const HORIZON = { "1h": 0, "1d": 1, "1w": 2 };

// keccak-256 is only needed for selectors; they are precomputed here so the SDK has no dependency.
const SEL = {
  markets: "3ac2a032",
  latestForecast: "80d8f287",
  averageScore: "253bd6fb",
  consensus: "127e6268",
  modelCount: "c6a645fe",
  forecastCount: "a8e9d279",
};

const word = (v) => BigInt(v).toString(16).padStart(64, "0");
const words = (hex) => (hex.startsWith("0x") ? hex.slice(2) : hex).match(/.{64}/g) ?? [];
const big = (w) => BigInt(`0x${w}`);

export class FlowTenzor {
  constructor({ oracle, rpc = "https://rpc.mainnet.chain.robinhood.com" } = {}) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(oracle ?? "")) throw new Error("FlowTenzor: pass the ForecastOracle address");
    this.oracle = oracle;
    this.rpc = rpc;
    this._markets = null;
  }

  async call(data) {
    const res = await fetch(this.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: this.oracle, data: `0x${data}` }, "latest"] }),
    });
    const body = await res.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  }

  /** [{ feed, symbol }] in market-id order. */
  async markets() {
    if (this._markets) return this._markets;
    const w = words(await this.call(SEL.markets));
    const n = Number(big(w[1]));
    const out = [];
    for (let i = 0; i < n; i++) {
      const feed = `0x${w[2 + i * 2].slice(24)}`;
      const symbol = new TextDecoder().decode(Uint8Array.from(w[3 + i * 2].match(/../g), (h) => parseInt(h, 16))).replace(/\0+$/, "");
      out.push({ feed, symbol });
    }
    this._markets = out;
    return out;
  }

  async marketId(symbol) {
    const i = (await this.markets()).findIndex((m) => m.symbol === symbol.toUpperCase());
    if (i < 0) throw new Error(`FlowTenzor: ${symbol} is not listed`);
    return i;
  }

  /** A model's latest forecast for a token and horizon ("1h" | "1d" | "1w"). Prices in USD. */
  async latestForecast(modelId, symbol, horizon) {
    const m = await this.marketId(symbol);
    const w = words(await this.call(SEL.latestForecast + word(modelId) + word(m) + word(HORIZON[horizon])));
    const status = ["none", "open", "scored", "void"][Number(big(w[4]))];
    return {
      status,
      confidence: Number(big(w[3])) / 100,
      score: Number(big(w[8])),
      committedAt: Number(big(w[9])),
      resolvesAt: Number(big(w[10])),
      low: Number(big(w[13])) / 1e8,
      high: Number(big(w[14])) / 1e8,
      reference: Number(big(w[15])) / 1e8,
      resolved: Number(big(w[16])) / 1e8 || null,
    };
  }

  /** Mean score (0 to 10,000) and how many forecasts it averages. */
  async averageScore(modelId, horizon) {
    const w = words(await this.call(SEL.averageScore + word(modelId) + word(HORIZON[horizon])));
    return { average: Number(big(w[0])), scored: Number(big(w[1])) };
  }

  /** Agreement among the given models' live forecasts: counts, average range and the spread of midpoints. */
  async consensus(symbol, horizon, modelIds) {
    const m = await this.marketId(symbol);
    const ids = modelIds.map((x) => word(x)).join("");
    const data = SEL.consensus + word(m) + word(HORIZON[horizon]) + word(96) + word(modelIds.length) + ids;
    const w = words(await this.call(data)).map(big);
    return {
      live: Number(w[0]),
      up: Number(w[1]),
      down: Number(w[2]),
      flat: Number(w[3]),
      low: Number(w[4]) / 1e8,
      high: Number(w[5]) / 1e8,
      confidence: Number(w[6]) / 100,
      spread: Number(w[9]) / 1e6,
    };
  }
}

export { HORIZON };
