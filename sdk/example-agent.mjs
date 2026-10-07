// A minimal agent loop: read the consensus of chosen models and print a decision. It does not trade.
//   ORACLE=0x… MODELS=1,2,3 node sdk/example-agent.mjs NVDA 1d
import { FlowTenzor } from "./flowtenzor.mjs";

const [symbol = "NVDA", horizon = "1d"] = process.argv.slice(2);
const ft = new FlowTenzor({ oracle: process.env.ORACLE, rpc: process.env.RPC_URL || undefined });
const models = (process.env.MODELS ?? "1").split(",").map((x) => BigInt(x.trim()));

const c = await ft.consensus(symbol, horizon, models);
const width = c.high && c.low ? (c.high - c.low) / ((c.high + c.low) / 2) : 0;
let decision = "stand aside";
if (c.live >= 3 && c.spread < width / 2) {
  if (c.up / c.live >= 0.75) decision = "lean long";
  else if (c.down / c.live >= 0.75) decision = "lean short";
}
console.log(JSON.stringify({ symbol, horizon, ...c, decision }, null, 2));
