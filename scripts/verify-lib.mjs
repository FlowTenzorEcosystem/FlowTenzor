// Checks behind scripts/verify-deployment.mjs, kept free of I/O so they can be tested with a fake chain.
//
// Every check fails closed: a missing transaction, an RPC error, an empty or malformed answer is a FAIL,
// never a skip. Comparisons are exact on lowercase hex.
//
// None of the FlowTenzor contracts uses immutables, so the runtime code at the address must equal the
// clean build byte for byte. The creation transaction's input must be exactly the build's creation code
// followed by the constructor arguments, and each argument is decoded and compared with the value this
// repository expects (stock feeds and symbols, USDG, pack terms, the token CA, the oracle address, bond terms).
// The values the contract reports through its getters are compared with the same expectations.

export const KINDS = ["ForecastOracle", "CallCredits", "ModelBond"];
export const CHAIN_ID = 4663;

const isHex = (v) => typeof v === "string" && /^0x([0-9a-fA-F]{2})*$/.test(v);
const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHash = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const norm = (v) => String(v).toLowerCase();
const word = (hex, i) => hex.slice(i * 64, (i + 1) * 64);
const wAddr = (w) => `0x${w.slice(24)}`;
const wNum = (w) => BigInt(`0x${w || "0"}`);
const pad = (n) => BigInt(n).toString(16).padStart(64, "0");

/** Decodes constructor arguments (hex without 0x) for one kind; throws on any malformed layout. */
export function decodeArgs(kind, hex) {
  if (kind === "ForecastOracle") {
    const feedsAt = Number(wNum(word(hex, 0))) / 32;
    const symsAt = Number(wNum(word(hex, 1))) / 32;
    const maxAge = wNum(word(hex, 2));
    const n = Number(wNum(word(hex, feedsAt)));
    const m = Number(wNum(word(hex, symsAt)));
    if (n !== m || n === 0 || n > 64) throw new Error("feeds and symbols differ in length");
    const feeds = Array.from({ length: n }, (_, i) => wAddr(word(hex, feedsAt + 1 + i)));
    const symbols = Array.from({ length: m }, (_, i) => Buffer.from(word(hex, symsAt + 1 + i), "hex").toString("utf8").replace(/\0+$/, ""));
    const expectedLength = (symsAt + 1 + m) * 64;
    if (hex.length !== expectedLength) throw new Error(`argument data is ${hex.length / 2} bytes, expected ${expectedLength / 2}`);
    return { feeds, symbols, maxReferenceAge: maxAge };
  }
  if (hex.length !== 4 * 64) throw new Error(`argument data is ${hex.length / 2} bytes, expected 128`);
  if (kind === "CallCredits") return { paymentToken: wAddr(word(hex, 0)), treasury: wAddr(word(hex, 1)), callsPerPack: wNum(word(hex, 2)), packPrice: wNum(word(hex, 3)) };
  if (kind === "ModelBond") return { token: wAddr(word(hex, 0)), oracle: wAddr(word(hex, 1)), bondAmount: wNum(word(hex, 2)), exitDelay: wNum(word(hex, 3)) };
  throw new Error(`unknown kind ${kind}`);
}

// Getter selectors (keccak of the signature, first 4 bytes).
const GET = {
  maxReferenceAge: "0xbc5c06af",
  marketCount: "0xec979082",
  market: "0x28861d22",
  paymentToken: "0x3013ce29",
  treasury: "0x61d027b3",
  callsPerPack: "0x6b2ffc5d",
  packPrice: "0x335c8b63",
  token: "0xfc0c546a",
  oracle: "0x7dc0d1d0",
  bondAmount: "0x80f323a7",
  exitDelay: "0x28388630",
};

/**
 * address, txHash, kind (optional), artifacts { name: { creation, runtime, immutables } }, rpc(method, params),
 * expected { stocks: [{ symbol, feed }], maxReferenceAge, usdg, callsPerPack, packPrice, ca, oracle, bondAmount, exitDelay },
 * configAddresses { ORACLE?, CREDITS?, BOND? }.
 */
export async function verifyDeployment({ address, txHash, kind, artifacts, rpc, expected, configAddresses = {} }) {
  const lines = [];
  let failed = false;
  const field = (label, ok, detail = "") => {
    lines.push(`${ok ? "OK  " : "FAIL"} ${label}${detail !== "" ? `: ${detail}` : ""}`);
    if (!ok) failed = true;
    return ok;
  };
  const done = (k = null) => ({ ok: !failed, lines, kind: failed ? null : k });
  const ask = async (label, method, params) => {
    try {
      return await rpc(method, params);
    } catch (e) {
      field(label, false, `RPC error: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  };

  if (!field("address format", isAddr(address), String(address))) return done();
  if (!field("creation transaction given (--tx)", isHash(txHash), String(txHash))) return done();
  if (kind !== undefined && !field("--kind is a known contract", KINDS.includes(kind), String(kind))) return done();
  const candidates = kind ? [kind] : KINDS;
  for (const name of candidates) {
    const a = artifacts?.[name];
    field(`${name} build present`, Boolean(a && isHex(a.creation) && isHex(a.runtime) && a.creation.length > 2 && a.runtime.length > 2));
    field(`${name} has no immutables`, Boolean(a) && a.immutables === 0, a ? `${a.immutables} immutable reference(s)` : "artifact missing");
  }
  if (failed) return done();

  const idHex = await ask("chain id readable", "eth_chainId", []);
  if (!field("chain id readable", typeof idHex === "string" && /^0x[0-9a-fA-F]+$/.test(idHex), String(idHex))) return done();
  field(`chain id is ${CHAIN_ID}`, Number(BigInt(idHex)) === CHAIN_ID, String(Number(BigInt(idHex))));

  const code = await ask("code readable", "eth_getCode", [address, "latest"]);
  if (!field("code readable", isHex(code), typeof code === "string" ? `${code.slice(0, 12)}…` : String(code))) return done();
  if (!field("address holds code", code.length > 2, `${(code.length - 2) / 2} bytes`)) return done();
  const matches = candidates.filter((n) => norm(artifacts[n].runtime) === norm(code));
  const match = matches.length === 1 ? matches[0] : null;
  if (!field(kind ? `runtime code equals the ${kind} build` : "runtime code equals exactly one build", match !== null, match ?? "no exact match")) return done();

  const tx = await ask("deployment transaction readable", "eth_getTransactionByHash", [txHash]);
  const receipt = await ask("deployment receipt readable", "eth_getTransactionReceipt", [txHash]);
  if (!field("deployment transaction found", tx !== null && typeof tx === "object")) return done();
  if (!field("deployment receipt found", receipt !== null && typeof receipt === "object")) return done();
  field("transaction hash matches", isHash(tx.hash) && norm(tx.hash) === norm(txHash), String(tx.hash));
  field("transaction is a contract creation (to = null)", tx.to === null, String(tx.to));
  field("transaction succeeded", receipt.status === "0x1", String(receipt.status));
  field("transaction created this address", isAddr(receipt.contractAddress) && norm(receipt.contractAddress) === norm(address), String(receipt.contractAddress));
  const creation = norm(artifacts[match].creation);
  const input = isHex(tx.input) ? norm(tx.input) : "";
  if (!field("creation input starts with the build's creation code", input.startsWith(creation) && input.length > creation.length)) return done();

  let args;
  try {
    args = decodeArgs(match, input.slice(creation.length));
    field("constructor arguments decode exactly", true);
  } catch (e) {
    field("constructor arguments decode exactly", false, e instanceof Error ? e.message : String(e));
    return done();
  }

  const call = async (label, data) => {
    const r = await ask(label, "eth_call", [{ to: address, data }, "latest"]);
    if (!isHex(r) || r.length < 66) {
      field(label, false, `bad answer ${String(r).slice(0, 20)}`);
      return null;
    }
    return r.slice(2);
  };

  if (match === "ForecastOracle") {
    const want = expected.stocks;
    field("market count equals the stock list", args.feeds.length === want.length, `${args.feeds.length} vs ${want.length}`);
    want.forEach((s, i) => {
      field(`market ${i} feed is ${s.symbol}'s Chainlink feed`, norm(args.feeds[i] ?? "") === norm(s.feed), String(args.feeds[i]));
      field(`market ${i} symbol is ${s.symbol}`, args.symbols[i] === s.symbol, String(args.symbols[i]));
    });
    field("maxReferenceAge argument", args.maxReferenceAge === BigInt(expected.maxReferenceAge), String(args.maxReferenceAge));
    const age = await call("maxReferenceAge() readable", GET.maxReferenceAge);
    if (age !== null) field("maxReferenceAge() on chain", wNum(age.slice(0, 64)) === BigInt(expected.maxReferenceAge), String(wNum(age.slice(0, 64))));
    const count = await call("marketCount() readable", GET.marketCount);
    if (count !== null) field("marketCount() on chain", Number(wNum(count.slice(0, 64))) === want.length, String(wNum(count.slice(0, 64))));
    const first = await call("market(0) readable", GET.market + pad(0));
    if (first !== null) field("market(0).feed on chain", norm(wAddr(first.slice(0, 64))) === norm(want[0].feed));
  }
  if (match === "CallCredits") {
    field("paymentToken argument is USDG", norm(args.paymentToken) === norm(expected.usdg), args.paymentToken);
    field("treasury argument is a non-zero address", isAddr(args.treasury) && !/^0x0{40}$/.test(args.treasury), args.treasury);
    field("callsPerPack argument", args.callsPerPack === BigInt(expected.callsPerPack), String(args.callsPerPack));
    field("packPrice argument", args.packPrice === BigInt(expected.packPrice), String(args.packPrice));
    for (const [label, sel, want] of [
      ["paymentToken()", GET.paymentToken, expected.usdg],
      ["treasury()", GET.treasury, args.treasury],
    ]) {
      const r = await call(`${label} readable`, sel);
      if (r !== null) field(`${label} on chain`, norm(wAddr(r.slice(0, 64))) === norm(want), wAddr(r.slice(0, 64)));
    }
    if (expected.treasury) field("treasury equals --treasury", norm(args.treasury) === norm(expected.treasury), args.treasury);
    else lines.push(`INFO treasury is ${args.treasury}; pass --treasury to require a specific address`);
  }
  if (match === "ModelBond") {
    field("token argument is the CA in src/config/brand.ts", isAddr(expected.ca) && norm(args.token) === norm(expected.ca), args.token);
    field("oracle argument is the ForecastOracle in src/config/contracts.ts", isAddr(expected.oracle) && norm(args.oracle) === norm(expected.oracle), args.oracle);
    field("bondAmount argument", args.bondAmount === BigInt(expected.bondAmount), String(args.bondAmount));
    field("exitDelay argument", args.exitDelay === BigInt(expected.exitDelay), String(args.exitDelay));
    const t = await call("token() readable", GET.token);
    if (t !== null) field("token() on chain", norm(wAddr(t.slice(0, 64))) === norm(expected.ca ?? ""));
    const o = await call("oracle() readable", GET.oracle);
    if (o !== null) field("oracle() on chain", norm(wAddr(o.slice(0, 64))) === norm(expected.oracle ?? ""));
  }

  const SLOT = { ORACLE: "ForecastOracle", CREDITS: "CallCredits", BOND: "ModelBond" };
  const listed = Object.entries(configAddresses).filter(([, v]) => isAddr(v) && norm(v) === norm(address));
  if (listed.length === 0) lines.push("INFO src/config/contracts.ts does not list this address yet");
  for (const [slot] of listed) field(`config slot ${slot} holds a ${SLOT[slot]}`, SLOT[slot] === match, String(match));
  return done(match);
}
