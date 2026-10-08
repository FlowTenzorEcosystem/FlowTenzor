"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  LayoutList,
  LogOut,
  Landmark,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { BRAND, CHAIN as chain, explorerAddress, shortAddress } from "@/config/brand";
import { WALLETCONNECT_RDNS, useWallet, type DiscoveredWallet } from "@/components/wallet/WalletProvider";
import { WALLET_CATALOG, catalogIcon } from "@/config/wallets";
import { useUsdgBalance } from "@/lib/useUsdg";

/* ------------------------------------------------------------------ */
/* One dialog for the whole site. Every "connect" / "get access" button */
/* opens it through this context instead of owning a copy of it.        */
/* ------------------------------------------------------------------ */

const ModalContext = createContext<{ open: () => void } | null>(null);

export function WalletModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useCallback(() => setOpen(true), []);
  return (
    <ModalContext.Provider value={{ open: value }}>
      {children}
      {open ? <WalletDialog onClose={() => setOpen(false)} /> : null}
    </ModalContext.Provider>
  );
}

export function useWalletModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useWalletModal must be used inside WalletModalProvider");
  return context;
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function WalletIcon({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" width={22} height={22} className="size-[22px] shrink-0 rounded-[5px]" />
  ) : (
    <Wallet className="size-[22px] shrink-0 rounded-[5px] border border-line-2 p-1 text-ink-2" />
  );
}

function WalletDialog({ onClose }: { onClose: () => void }) {
  const { wallets, connect, connecting, error, clearError } = useWallet();
  const [pending, setPending] = useState<string | null>(null);

  const close = useCallback(() => {
    onClose();
    clearError();
  }, [onClose, clearError]);

  useEffect(() => {
    // Late-loading extensions announce on request, so ask again on open.
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const installed = wallets
    .filter((w) => w.rdns !== WALLETCONNECT_RDNS)
    .sort((a, b) => Number(Boolean(a.unsupported)) - Number(Boolean(b.unsupported)));
  const walletConnect = wallets.find((w) => w.rdns === WALLETCONNECT_RDNS) ?? null;
  const detected = new Set(wallets.map((w) => w.rdns));
  const more = WALLET_CATALOG.filter((c) => !c.rdns.some((r) => detected.has(r)));
  const mobile = isMobile();
  const here = window.location.href;

  async function pick(wallet: DiscoveredWallet) {
    setPending(wallet.rdns);
    const ok = await connect(wallet);
    setPending(null);
    if (ok) onClose();
  }

  const row =
    "flex h-11 w-full items-center gap-3 rounded-[6px] border border-line bg-card px-3 text-left text-[13.5px] text-ink";
  const heading = "label pb-2 pl-0.5";

  // The header blurs what is behind it, and a backdrop filter turns it into
  // the containing block for fixed children. Rendered in place, the dialog
  // would be clipped to the header, so it always goes to <body>.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-dialog-title"
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4"
    >
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.6)]" onClick={close} />
      <div className="panel relative flex max-h-[92dvh] w-full max-w-[400px] flex-col overflow-hidden !rounded-b-none bg-black sm:!rounded-[8px]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="label">Sign in</p>
            <h2 id="wallet-dialog-title" className="mt-1.5 text-[17px] leading-tight font-medium tracking-[-0.02em] text-ink">
              Connect a wallet
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="grid size-7 cursor-pointer place-items-center rounded-[5px] border border-line text-ink-3 transition-colors hover:border-line-2 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <p className="px-4 pt-3 text-[12.5px] leading-relaxed text-ink-3">
          Any EVM wallet that can add a custom network works on {chain.name}. Connecting only shares your address;
          signatures and swaps are asked for separately.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-3">
          {installed.length ? (
            <>
              <p className={heading}>Detected in this browser</p>
              <ul className="flex flex-col gap-1.5">
                {installed.map((wallet) => (
                  <li key={wallet.rdns}>
                    <button
                      type="button"
                      disabled={connecting || Boolean(wallet.unsupported)}
                      onClick={() => pick(wallet)}
                      className={`${row} cursor-pointer transition-colors enabled:hover:border-line-2 enabled:hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <WalletIcon src={wallet.icon || catalogIcon(wallet.rdns)} />
                      <span className="min-w-0 flex-1">
                        <span className="block">{wallet.name}</span>
                        <span className="block text-[11.5px] text-ink-3">
                          {wallet.unsupported ? `Not supported · ${wallet.unsupported}` : "Installed"}
                        </span>
                      </span>
                      {pending === wallet.rdns ? (
                        <span className="label !text-ink">Check wallet</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className={`${heading} pt-4`}>Mobile and other wallets</p>
          {walletConnect ? (
            <button
              type="button"
              disabled={connecting}
              onClick={() => pick(walletConnect)}
              className={`${row} cursor-pointer transition-colors enabled:hover:border-line-2 enabled:hover:bg-paper-2 disabled:opacity-45`}
              data-testid="wallet-walletconnect"
            >
              <WalletIcon src="/wallets/walletconnect.webp" />
              <span className="min-w-0 flex-1">
                <span className="block">WalletConnect</span>
                <span className="block text-[11.5px] text-ink-3">Scan a QR code with a mobile wallet</span>
              </span>
              {pending === WALLETCONNECT_RDNS ? (
                <span className="label !text-ink">Opening</span>
              ) : null}
            </button>
          ) : (
            <div className={`${row} opacity-45`} data-testid="wallet-walletconnect">
              <WalletIcon src="/wallets/walletconnect.webp" />
              <span className="min-w-0 flex-1">
                <span className="block">WalletConnect</span>
                <span className="block text-[11.5px] text-ink-3">Not configured on this site yet</span>
              </span>
            </div>
          )}

          {more.length ? (
            <>
              <p className={`${heading} pt-4`}>
                {mobile ? "Open this site in a wallet app" : `Not installed · supports ${chain.name}`}
              </p>
              <ul className="flex flex-col gap-1.5">
                {more.map((w) => {
                  const href = mobile && w.deepLink ? w.deepLink(here) : w.install;
                  const label = mobile && w.deepLink ? "Open" : "Install";
                  return (
                    <li key={w.id}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className={`${row} transition-colors hover:border-line-2 hover:bg-paper-2`}
                      >
                        <WalletIcon src={`/wallets/${w.id}.webp`} />
                        <span className="min-w-0 flex-1">{w.name}</span>
                        <span className="label inline-flex items-center gap-1 rounded-[3px] border border-line-2 px-1.5 py-1 !text-ink">
                          {label} <ExternalLink className="size-3" />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>

        {error ? (
          <p className="flex items-start gap-2 border-t border-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <p className="label flex items-center gap-2 border-t border-line px-4 py-3 !normal-case !tracking-normal">
          <span className="size-1.5 rounded-full bg-ink" />
          <span className="text-ink-2">{chain.name}</span> · chain id {chain.id} · added to your wallet on connect
        </p>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Navbar control                                                      */
/* ------------------------------------------------------------------ */

export function NavWallet({ compact = false }: { compact?: boolean }) {
  const { address } = useWallet();
  const { open } = useWalletModal();
  if (address) return <AccountMenu compact={compact} />;
  return (
    <button type="button" onClick={open} className="abtn whitespace-nowrap" data-testid="nav-connect">
      Sign in
    </button>
  );
}

function MenuRow({ children, onClick, href, external, testid }: { children: React.ReactNode; onClick?: () => void; href?: string; external?: boolean; testid?: string }) {
  const cls = "flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-[5px] px-2.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-paper-3 hover:text-ink";
  if (href && external)
    return (
      <a role="menuitem" href={href} target="_blank" rel="noreferrer" className={cls} data-testid={testid}>
        {children}
      </a>
    );
  if (href)
    return (
      <Link role="menuitem" href={href} onClick={onClick} className={cls} data-testid={testid}>
        {children}
      </Link>
    );
  return (
    <button type="button" role="menuitem" onClick={onClick} className={cls} data-testid={testid}>
      {children}
    </button>
  );
}

function AccountMenu({ compact }: { compact: boolean }) {
  const {
    address,
    walletName,
    chainId,
    balance,
    onRobinhoodChain,
    switchNetwork,
    switching,
    disconnect,
    error,
  } = useWallet();
  const usdg = useUsdgBalance(address);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const WIDTH = 296;
    const position = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.right - WIDTH, window.innerWidth - WIDTH - 8));
      setPlace({ top: rect.bottom + 6, left });
    };
    position();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open]);

  if (!address) return null;
  const wrongNetwork = chainId !== null && !onRobinhoodChain;

  return (
    <div ref={root} className="flex shrink-0 items-center gap-1.5">
      {wrongNetwork && !compact ? (
        <button
          type="button"
          onClick={switchNetwork}
          disabled={switching}
          title={`Wallet is on chain ${chainId}. Switch to ${chain.name}.`}
          className="abtn !border-dashed !text-ink"
        >
          <TriangleAlert className="size-3.5" />
          {switching ? "Confirm…" : `Chain ${chainId}`}
        </button>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        data-testid="wallet-chip"
        className={`flex h-8 cursor-pointer items-center gap-2 rounded-[6px] border bg-card pr-2 pl-2.5 transition-colors hover:border-line-2 ${open ? "border-line-2" : "border-line"}`}
      >
        <span
          className={`size-[7px] rounded-full ${onRobinhoodChain ? "bg-[#4fd69a] shadow-[0_0_6px_#4fd69a]" : "bg-[#f2826a] shadow-[0_0_6px_#f2826a]"}`}
          data-testid="wallet-dot"
          data-network={onRobinhoodChain ? "ok" : "wrong"}
        />
        <span className="num text-[11.5px] text-ink">{shortAddress(address, compact ? 4 : 6, 4)}</span>
        <ChevronDown className={`size-3 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && place
        ? createPortal(
            <div
              ref={menu}
              role="menu"
              style={{ position: "fixed", top: place.top, left: place.left }}
              className="panel z-[80] w-[296px] overflow-hidden bg-black"
              data-testid="wallet-menu"
            >
              <div className="border-b border-line p-3">
                <div className="flex items-center justify-between">
                  <p className="label">{walletName ?? "Wallet"}</p>
                  <span className={`chip !py-0 ${wrongNetwork ? "!border-dashed" : ""}`}>
                    {chainId === null ? "Reading" : onRobinhoodChain ? `RHC · ${chain.id}` : `Chain ${chainId}`}
                  </span>
                </div>
                <p className="num mt-2 text-[12.5px] text-ink">{shortAddress(address, 10, 8)}</p>
                <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[5px] border border-line bg-line">
                  <div className="bg-card px-2.5 py-2">
                    <dt className="label">{chain.nativeSymbol}</dt>
                    <dd className="num mt-1 text-[13px] text-ink" data-testid="menu-eth">
                      {balance === null ? "…" : balance}
                    </dd>
                  </div>
                  <div className="bg-card px-2.5 py-2">
                    <dt className="label">USDG</dt>
                    <dd className="num mt-1 text-[13px] text-ink" data-testid="menu-usdg">
                      {usdg === null ? "…" : usdg}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2 flex items-center justify-between gap-2 rounded-[5px] border border-line px-2.5 py-1.5">
                  <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
                    <span className={`size-1.5 rounded-full ${onRobinhoodChain ? "bg-[#4fd69a]" : "bg-[#f2826a]"}`} />
                    {chainId === null ? "Reading network…" : onRobinhoodChain ? `On ${chain.name}` : `Not on ${chain.name}`}
                  </span>
                  {wrongNetwork ? (
                    <button type="button" role="menuitem" disabled={switching} onClick={switchNetwork} className="abtn abtn-face !h-6 !px-2 !text-[11.5px]" data-testid="menu-switch">
                      {switching ? "Confirm…" : "Switch"}
                    </button>
                  ) : null}
                </div>
                {error && wrongNetwork ? <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{error}</p> : null}
              </div>
              <div className="flex flex-col p-1.5">
                <MenuRow href="/arena" onClick={() => setOpen(false)}>
                  <LayoutList className="size-3.5" /> Open app · your forecasts
                </MenuRow>
                <MenuRow
                  testid="menu-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(address);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    } catch {
                      // Clipboard refused; the address above stays readable.
                    }
                  }}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy address"}
                </MenuRow>
                <MenuRow href="/token" onClick={() => setOpen(false)}>
                  <Landmark className="size-3.5" /> Token · {BRAND.symbol}
                </MenuRow>
                <MenuRow href="/swap" onClick={() => setOpen(false)}>
                  <ArrowLeftRight className="size-3.5" /> Swap {BRAND.symbol}
                </MenuRow>
                <MenuRow href={explorerAddress(address)} external>
                  <ExternalLink className="size-3.5" /> View on explorer
                </MenuRow>
              </div>
              <div className="border-t border-line p-1.5">
                <MenuRow
                  testid="menu-disconnect"
                  onClick={() => {
                    setOpen(false);
                    disconnect();
                  }}
                >
                  <LogOut className="size-3.5" /> Disconnect
                </MenuRow>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Large call-to-action ("Connect wallet")                          */
/* ------------------------------------------------------------------ */

export function AccessButton({ className = "" }: { className?: string }) {
  const { address, onRobinhoodChain, chainId, switchNetwork, switching } = useWallet();
  const { open } = useWalletModal();

  if (address && chainId !== null && !onRobinhoodChain) {
    return (
      <button type="button" onClick={switchNetwork} disabled={switching} className={`btn btn-accent ${className}`}>
        {switching ? "Confirm in wallet…" : `Switch to ${chain.name}`}
        <span aria-hidden="true">→</span>
      </button>
    );
  }
  if (address) {
    return (
      <Link href="/arena" className={`btn btn-accent ${className}`}>
        <span>
          Wallet linked · <span className="normal-case">{shortAddress(address, 4, 4)}</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={open} className={`btn btn-accent ${className}`}>
      Connect wallet
      <span aria-hidden="true">→</span>
    </button>
  );
}
