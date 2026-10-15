"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AlertsTable from "@/components/AlertsTable";
import StatsCards from "@/components/StatsCards";
import {
  DEMO_ALERTS,
  DEMO_STATS,
  WS_URL,
  fetchAlerts,
  fetchStats,
  updateAlertStatus,
} from "@/lib/api";
import { Alert, AlertStatus, Stats, WsMessage } from "@/lib/types";

type Filter = "all" | AlertStatus;
const FILTERS: Filter[] = ["all", "pending", "approved", "blocked", "escalated"];

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [demoMode, setDemoMode] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Insert a new alert or replace an updated one (newest first).
  const upsert = useCallback((incoming: Alert) => {
    setAlerts((prev) => {
      const exists = prev.some((a) => a.id === incoming.id);
      const next = exists
        ? prev.map((a) => (a.id === incoming.id ? incoming : a))
        : [incoming, ...prev];
      return next.slice(0, 200);
    });
  }, []);

  // Initial load.
  useEffect(() => {
    fetchAlerts()
      .then(setAlerts)
      .catch(() => {
        setAlerts(DEMO_ALERTS);
        setDemoMode(true);
      });
  }, []);

  // Poll the counters every 3 seconds.
  useEffect(() => {
    const load = () =>
      fetchStats()
        .then(setStats)
        .catch(() => {
          setStats(DEMO_STATS);
          setDemoMode(true);
        });
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  // Live WebSocket connection with auto-reconnect.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        setConnected(true);
        setError(null);
      };
      ws.onmessage = (e) => {
        const msg: WsMessage = JSON.parse(e.data);
        upsert(msg.alert);
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retryTimer.current = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      ws?.close();
    };
  }, [upsert]);

  const handleAction = async (id: number, status: Exclude<AlertStatus, "pending">) => {
    setBusyId(id);
    try {
      if (demoMode) {
        const current = alerts.find((alert) => alert.id === id);
        if (current) upsert({ ...current, status });
      } else {
        upsert(await updateAlertStatus(id, status));
      }
    } catch {
      setDemoMode(true);
      setError("Live backend unavailable. Switched to demo mode.");
    } finally {
      setBusyId(null);
    }
  };

  const visible = filter === "all" ? alerts : alerts.filter((a) => a.status === filter);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Fraud<span className="text-violet-400">Lens</span>
          </h1>
          <p className="text-sm text-slate-400">
            Live analyst dashboard. Transactions are a simulated stream from the Kaggle dataset.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            connected
              ? "border-emerald-500/40 text-emerald-300"
              : "border-red-500/40 text-red-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "animate-pulse bg-emerald-400" : "bg-red-400"
            }`}
          />
          {connected ? "Live" : "Disconnected"}
        </span>
      </header>

      {demoMode && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Demo mode: connect a FastAPI backend to see live alerts and scoring.
        </div>
      )}

      {error && !demoMode && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <StatsCards alerts={alerts} stats={stats} />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs capitalize ${
              filter === f
                ? "bg-violet-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <AlertsTable alerts={visible} busyId={busyId} onAction={handleAction} />
    </main>
  );
}
