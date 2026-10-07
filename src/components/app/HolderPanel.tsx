"use client";

import { useEffect, useState } from "react";
import { BRAND, TOKEN } from "@/config/brand";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { balanceOf } from "@/lib/onchain/oracle";

/** The connected wallet's $FLOWTENZOR balance, read on chain once the token is live. */
export function HolderPanel() {
  const wallet = useWallet();
  const modal = useWalletModal();
  const [bal, setBal] = useState<bigint | null>(null);
  useEffect(() => {
    if (!TOKEN.isLive || !wallet.address) return;
    balanceOf(BRAND.ca, wallet.address)
      .then(setBal)
      .catch(() => setBal(null));
  }, [wallet.address]);
  return (
    <div className="text-[14px] text-ink-2" data-testid="holder-panel">
      {!TOKEN.isLive ? (
        <p>Balances are read here once {BRAND.symbol} is live. Holding in your own wallet is all access will ever ask for: no staking, no locking.</p>
      ) : !wallet.address ? (
        <button type="button" className="btn btn-ink btn-sm" onClick={modal.open}>
          Connect to read your balance
        </button>
      ) : (
        <p>
          This wallet holds <span className="num text-ink">{bal == null ? "…" : (Number(bal) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })}</span> {BRAND.symbol}.
        </p>
      )}
    </div>
  );
}
