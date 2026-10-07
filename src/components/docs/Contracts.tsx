import { CHAIN, shortAddress } from "@/config/brand";
import { CONTRACTS, DEPLOY } from "@/config/contracts";

const ROWS = [
  { key: "oracle" as const, when: "now (no token needed)", job: "Records and scores forecasts against Chainlink." },
  { key: "credits" as const, when: "now (needs a treasury address)", job: `Sells API call packs: ${DEPLOY.callsPerPack.toLocaleString("en-US")} calls per ${DEPLOY.packPrice / 1e6} USDG, paid to the treasury.` },
  { key: "bond" as const, when: "after the token launches", job: "Holds a refundable token bond per model." },
];

/** Contract list with live addresses (empty until deployed) and explorer links. */
export function ContractsTable() {
  return (
    <div className="scroll-x my-4 rounded-[10px] border border-line" data-testid="contracts-table">
      <table className="tbl min-w-[620px] text-[13px]">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Address</th>
            <th>Deploy</th>
            <th>Job</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const c = CONTRACTS[r.key];
            return (
              <tr key={r.key}>
                <td className="font-semibold text-ink">{c.name}</td>
                <td className="num">
                  {c.address ? (
                    <a className="link" href={`${CHAIN.explorer}/address/${c.address}`} target="_blank" rel="noreferrer">
                      {shortAddress(c.address)}
                    </a>
                  ) : (
                    <span className="text-ink-3">not deployed</span>
                  )}
                </td>
                <td className="text-ink-2">{r.when}</td>
                <td className="text-ink-2">{r.job}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
