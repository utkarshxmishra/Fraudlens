import { Alert, AlertStatus, Stats } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/alerts";

export const DEMO_ALERTS: Alert[] = [
  {
    id: 1042,
    created_at: "2026-10-15T09:42:00.000Z",
    amount: 1842.76,
    probability: 0.97,
    risk: "high",
    status: "pending",
    actual_class: 1,
  },
  {
    id: 1041,
    created_at: "2026-10-15T09:40:00.000Z",
    amount: 623.19,
    probability: 0.88,
    risk: "high",
    status: "escalated",
    actual_class: 1,
  },
  {
    id: 1040,
    created_at: "2026-10-15T09:37:00.000Z",
    amount: 91.5,
    probability: 0.84,
    risk: "high",
    status: "blocked",
    actual_class: 1,
  },
  {
    id: 1039,
    created_at: "2026-10-15T09:35:00.000Z",
    amount: 48.22,
    probability: 0.81,
    risk: "high",
    status: "approved",
    actual_class: 0,
  },
];

export const DEMO_STATS: Stats = {
  processed: 1042,
  flagged: 4,
  avg_latency_ms: 2.4,
  threshold: 0.73,
};

export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch(`${API_URL}/alerts?limit=200`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load alerts (${res.status})`);
  return res.json();
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_URL}/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load stats (${res.status})`);
  return res.json();
}

export async function updateAlertStatus(
  id: number,
  status: Exclude<AlertStatus, "pending">
): Promise<Alert> {
  const res = await fetch(`${API_URL}/alerts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update alert (${res.status})`);
  return res.json();
}
