import "server-only";
import { CONTRACTS, bondLive, oracleLive } from "@/config/contracts";
import { ethCall } from "@/lib/feeds/rpc";
import { decodeModel, decodeStats, encodeIsBonded, encodeModel, encodeModelCount, encodeStats, type ChainModel, type ChainStats } from "@/lib/onchain/calls";

/* Server-side reads of the ForecastOracle (and ModelBond) for the leaderboard. Cached 60 s. */

export type ChainEntry = { model: ChainModel; stats: [ChainStats, ChainStats, ChainStats]; bonded: boolean | null };

let cache: { at: number; value: ChainEntry[] } | null = null;

export async function chainLeaderboard(limit = 100): Promise<ChainEntry[] | null> {
  if (!oracleLive()) return null;
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  try {
    const oracle = CONTRACTS.oracle.address;
    const n = Number(BigInt(await ethCall(oracle, encodeModelCount())));
    const ids = Array.from({ length: Math.min(n, limit) }, (_, i) => BigInt(n - i));
    const value = await Promise.all(
      ids.map(async (id) => {
        const [m, s0, s1, s2, b] = await Promise.all([
          ethCall(oracle, encodeModel(id)),
          ethCall(oracle, encodeStats(id, 0)),
          ethCall(oracle, encodeStats(id, 1)),
          ethCall(oracle, encodeStats(id, 2)),
          bondLive() ? ethCall(CONTRACTS.bond.address, encodeIsBonded(id)).catch(() => null) : Promise.resolve(null),
        ]);
        return {
          model: decodeModel(m, id),
          stats: [decodeStats(s0), decodeStats(s1), decodeStats(s2)] as [ChainStats, ChainStats, ChainStats],
          bonded: b === null ? null : BigInt(b) === 1n,
        };
      }),
    );
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return cache?.value ?? [];
  }
}
