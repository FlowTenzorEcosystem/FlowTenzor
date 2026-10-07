import { BRAND } from "@/config/brand";

/**
 * Domain named in every message the site asks a wallet to sign. It is never
 * taken from the request on trust: a look-alike site could otherwise obtain a
 * ticket in its own name, have a visitor sign it there and replay the
 * signature here. Only the project's own domain is accepted. localhost is an
 * explicit opt-in for local testing (ALLOW_LOCALHOST_SIGNIN=1, or a
 * development build); a self-hosted production server never accepts it.
 */
export function signInDomain(requestHost: string | null, env: Record<string, string | undefined> = process.env) {
  const host = (requestHost ?? "").toLowerCase();
  if (host === BRAND.domain || host === `www.${BRAND.domain}`) return host;
  const localAllowed = env.ALLOW_LOCALHOST_SIGNIN === "1" || env.NODE_ENV === "development";
  if (localAllowed && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host)) return host;
  return BRAND.domain;
}
