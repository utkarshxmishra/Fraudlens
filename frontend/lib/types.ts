export type AlertStatus = "pending" | "approved" | "blocked" | "escalated";
export type RiskLevel = "low" | "medium" | "high";

export interface Alert {
  id: number;
  created_at: string;
  amount: number;
  probability: number;
  risk: RiskLevel;
  status: AlertStatus;
  /** Ground-truth label from the simulated dataset (1 = real fraud). Demo only. */
  actual_class: number | null;
}

export interface Stats {
  processed: number;
  flagged: number;
  avg_latency_ms: number;
  threshold: number;
}

export type WsMessage =
  | { type: "alert"; alert: Alert }
  | { type: "alert_updated"; alert: Alert };
