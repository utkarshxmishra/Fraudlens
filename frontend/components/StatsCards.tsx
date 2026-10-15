import { Alert, Stats } from "@/lib/types";

function Card({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function StatsCards({ alerts, stats }: { alerts: Alert[]; stats: Stats | null }) {
  const count = (s: string) => alerts.filter((a) => a.status === s).length;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <Card label="Transactions scored" value={stats ? stats.processed.toLocaleString() : "-"} />
      <Card
        label="Avg scoring time"
        value={stats ? `${stats.avg_latency_ms.toFixed(1)} ms` : "-"}
        hint="per transaction"
      />
      <Card label="Pending" value={count("pending")} hint="need review" />
      <Card label="Approved" value={count("approved")} />
      <Card label="Blocked" value={count("blocked")} />
      <Card label="Escalated" value={count("escalated")} />
    </div>
  );
}
