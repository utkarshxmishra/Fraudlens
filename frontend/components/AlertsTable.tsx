import { Alert, AlertStatus, RiskLevel } from "@/lib/types";

const riskStyle: Record<RiskLevel, string> = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const statusStyle: Record<AlertStatus, string> = {
  pending: "bg-slate-500/20 text-slate-300",
  approved: "bg-emerald-500/20 text-emerald-300",
  blocked: "bg-red-500/20 text-red-300",
  escalated: "bg-violet-500/20 text-violet-300",
};

interface Props {
  alerts: Alert[];
  busyId: number | null;
  onAction: (id: number, status: Exclude<AlertStatus, "pending">) => void;
}

export default function AlertsTable({ alerts, busyId, onAction }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
        No alerts yet. Waiting for the live transaction stream...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3">Fraud probability</th>
            <th className="px-4 py-3">Risk</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" title="Label from the simulated dataset, for demo only">
              Actual (demo)
            </th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950">
          {alerts.map((a) => {
            const done = a.status !== "pending";
            const busy = busyId === a.id;
            return (
              <tr key={a.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3 text-slate-400">#{a.id}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {new Date(a.created_at).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">${a.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 rounded bg-slate-800">
                      <div
                        className="h-1.5 rounded bg-red-400"
                        style={{ width: `${Math.min(100, a.probability * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums">{(a.probability * 100).toFixed(1)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${riskStyle[a.risk]}`}>
                    {a.risk}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle[a.status]}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {a.actual_class === null ? "-" : a.actual_class === 1 ? "fraud" : "legit"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button
                      disabled={done || busy}
                      onClick={() => onAction(a.id, "approved")}
                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Approve
                    </button>
                    <button
                      disabled={done || busy}
                      onClick={() => onAction(a.id, "blocked")}
                      className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Block
                    </button>
                    <button
                      disabled={done || busy}
                      onClick={() => onAction(a.id, "escalated")}
                      className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Escalate
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
