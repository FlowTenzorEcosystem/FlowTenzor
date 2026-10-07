"use client";

import { useState } from "react";
import { BRAND, CHAIN, USDG, isAddress } from "@/config/brand";
import { CONTRACTS, DEPLOY, type ContractKey } from "@/config/contracts";
import { STOCKS } from "@/config/stocks";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CALLCREDITS_BYTECODE, FORECASTORACLE_BYTECODE, MODELBOND_BYTECODE } from "@/lib/onchain/bytecode";
import { encodeBondArgs, encodeCreditsArgs, encodeOracleArgs } from "@/lib/onchain/calls";
import { simulate, txUrl, waitReceipt } from "@/lib/onchain/client";

/*
 * Owner tool: deploys the FlowTenzor contracts from the connected wallet (no
 * key ever touches the site) with the constructor arguments shown, then
 * prints the lines to paste into src/config/contracts.ts. Removed once the
 * contracts are deployed and verified.
 */

type Result = { address: string; block: number; hash: string };
const VAR: Record<ContractKey, string> = { oracle: "ORACLE", credits: "CREDITS", bond: "BOND" };

export function DeployPanel() {
  const { address, onRobinhoodChain, switchNetwork, sendTransaction } = useWallet();
  const { open } = useWalletModal();
  const [treasury, setTreasury] = useState("");
  const [stage, setStage] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Partial<Record<ContractKey, Result>>>({});
  const oracleAddress = CONTRACTS.oracle.address || results.oracle?.address || "";

  const items: { key: ContractKey; what: string; args: [string, string][]; data: () => string | null; blocker: string | null; gas: string }[] = [
    {
      key: "oracle",
      what: "Records and scores forecasts against Chainlink. No owner, no admin key, no fee. Does not need the token: deploy any time.",
      args: [
        ["feeds", `${STOCKS.length} Chainlink proxies (src/config/stocks.ts order)`],
        ["symbols", STOCKS.map((s) => s.symbol).join(", ")],
        ["maxReferenceAge", `${DEPLOY.maxReferenceAge} s (${DEPLOY.maxReferenceAge / 86_400} days)`],
      ],
      data: () => FORECASTORACLE_BYTECODE + encodeOracleArgs(STOCKS.map((s) => s.feed), STOCKS.map((s) => s.symbol), DEPLOY.maxReferenceAge),
      blocker: null,
      gas: "6.91 million gas (measured on a mainnet fork)",
    },
    {
      key: "credits",
      what: "Sells API call packs for USDG, paid straight to the treasury. No owner. Does not need the token.",
      args: [
        ["paymentToken", `${USDG.address} (${USDG.symbol})`],
        ["treasury", isAddress(treasury) ? treasury : "enter below"],
        ["callsPerPack", String(DEPLOY.callsPerPack)],
        ["packPrice", `${DEPLOY.packPrice} (${DEPLOY.packPrice / 10 ** USDG.decimals} ${USDG.symbol})`],
      ],
      data: () => (isAddress(treasury) ? CALLCREDITS_BYTECODE + encodeCreditsArgs(USDG.address, treasury, DEPLOY.callsPerPack, DEPLOY.packPrice) : null),
      blocker: isAddress(treasury) ? null : "Enter the treasury address first.",
      gas: "0.46 million gas (measured)",
    },
    {
      key: "bond",
      what: `Refundable ${BRAND.symbol} bond per model. Needs the token address and the oracle address.`,
      args: [
        ["token", isAddress(BRAND.ca) ? BRAND.ca : "the CA (not set yet)"],
        ["oracle", oracleAddress || "deploy ForecastOracle first"],
        ["bondAmount", `${DEPLOY.bondAmount} (${Number(BigInt(DEPLOY.bondAmount) / 10n ** 18n).toLocaleString("en-US")} tokens at 18 decimals)`],
        ["exitDelay", `${DEPLOY.exitDelay} s (${DEPLOY.exitDelay / 86_400} days)`],
      ],
      data: () => (isAddress(BRAND.ca) && isAddress(oracleAddress) ? MODELBOND_BYTECODE + encodeBondArgs(BRAND.ca, oracleAddress, BigInt(DEPLOY.bondAmount), DEPLOY.exitDelay) : null),
      blocker: !isAddress(BRAND.ca) ? "Waits for the token: set the CA in src/config/brand.ts and redeploy the site." : !isAddress(oracleAddress) ? "Deploy ForecastOracle first." : null,
      gas: "0.73 million gas (measured in tests)",
    },
  ];

  const deploy = async (key: ContractKey, data: string | null) => {
    if (!address || !data) return;
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      setStage((s) => ({ ...s, [key]: "Checking…" }));
      await simulate({ from: address, data });
      setStage((s) => ({ ...s, [key]: "Confirm in wallet…" }));
      const hash = await sendTransaction({ data });
      setStage((s) => ({ ...s, [key]: "Waiting for the block…" }));
      const receipt = await waitReceipt(hash);
      if (!receipt.contractAddress) throw new Error("The receipt has no contract address.");
      setResults((r) => ({ ...r, [key]: { address: receipt.contractAddress!, block: Number(BigInt(receipt.blockNumber)), hash } }));
    } catch (cause) {
      setErrors((e) => ({ ...e, [key]: cause instanceof Error ? cause.message : "Deployment failed." }));
    } finally {
      setStage((s) => ({ ...s, [key]: "" }));
    }
  };

  const snippet = (Object.keys(VAR) as ContractKey[])
    .filter((k) => results[k])
    .map((k) => `const ${VAR[k]} = "${results[k]!.address}";\nconst ${VAR[k]}_BLOCK = ${results[k]!.block};`)
    .join("\n");

  return (
    <div className="max-w-[980px]">
      <p className="kicker">Owner tool · not linked from the site</p>
      <h1 className="h-sec mt-2">Deploy the contracts</h1>
      <p className="mt-3 text-[15px] text-ink-2">
        Deploys to {CHAIN.name} (chain {CHAIN.id}) from your connected wallet, with the constructor arguments shown. Nothing about these contracts can be
        changed after deployment. Order: ForecastOracle, then CallCredits (any time), then ModelBond once the token exists.
      </p>
      <div className="mt-6 space-y-4">
        {items.map((i) => {
          const live = CONTRACTS[i.key].address;
          const r = results[i.key];
          const data = i.data();
          return (
            <section key={i.key} className="rounded-[12px] border border-line bg-card p-5" data-testid={`deploy-${i.key}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[17px] font-semibold text-ink">{CONTRACTS[i.key].name}</p>
                <span className="num text-[12.5px] text-ink-3">{i.gas}</span>
              </div>
              <p className="mt-1 text-[14px] text-ink-2">{i.what}</p>
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-[140px_minmax(0,1fr)]">
                {i.args.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="num text-ink-3">{k}</dt>
                    <dd className="num break-all text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {i.key === "credits" ? (
                <input value={treasury} onChange={(e) => setTreasury(e.target.value.trim())} placeholder="Treasury address (0x…), receives every payment" aria-label="Treasury address" className="field num mt-3 text-[13px]" data-testid="deploy-treasury" />
              ) : null}
              {live ? (
                <p className="mt-2 text-[13.5px]">
                  Live at{" "}
                  <a href={`${CHAIN.explorer}/address/${live}`} target="_blank" rel="noreferrer" className="num link">
                    {live}
                  </a>
                </p>
              ) : null}
              <div className="mt-3">
                {!address ? (
                  <button type="button" onClick={open} className="btn btn-ink btn-sm">
                    Connect wallet
                  </button>
                ) : !onRobinhoodChain ? (
                  <button type="button" onClick={switchNetwork} className="btn btn-ink btn-sm">
                    Switch to {CHAIN.name}
                  </button>
                ) : (
                  <button type="button" onClick={() => deploy(i.key, data)} disabled={Boolean(stage[i.key]) || !data} className="btn btn-accent btn-sm" data-testid={`deploy-${i.key}-submit`}>
                    {stage[i.key] || `Deploy ${CONTRACTS[i.key].name}`}
                  </button>
                )}
                {i.blocker ? <p className="mt-2 text-[13px] text-ink-3">{i.blocker}</p> : null}
              </div>
              {errors[i.key] ? <p className="mt-2 text-[13px] text-down">{errors[i.key]}</p> : null}
              {r ? (
                <p className="mt-2 text-[13.5px] text-up" data-testid={`deploy-${i.key}-result`}>
                  Deployed at <span className="num">{r.address}</span> in block {r.block.toLocaleString("en-US")}.{" "}
                  <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="underline">
                    transaction ↗
                  </a>
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
      {snippet ? (
        <div className="mt-6 rounded-[12px] border border-line bg-card p-5">
          <p className="text-[14px] font-semibold text-ink">Paste into src/config/contracts.ts (replacing the empty lines), then push:</p>
          <pre className="num mt-2 overflow-x-auto rounded-[8px] bg-paper-2 p-3 text-[12px] text-ink" data-testid="deploy-snippet">
            {snippet}
          </pre>
          <p className="mt-2 text-[13px] text-ink-2">Then check each one: npm run verify-deployment -- &lt;address&gt; --tx &lt;hash&gt; (see the README).</p>
        </div>
      ) : null}
    </div>
  );
}
