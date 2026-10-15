"""FraudLens API (FastAPI).

Run (from backend/):  uvicorn main:app --reload
Docs / test page   :  http://localhost:8000/docs

Endpoints
  GET   /health            service status
  GET   /stats             processed / flagged counts + average scoring latency
  POST  /score             score ONE transaction
  GET   /alerts            list alerts (optional ?status=pending)
  PATCH /alerts/{id}       set status: approved | blocked | escalated
  WS    /ws/alerts         live push of new / updated alerts

A background task replays rows from data/stream_sample.csv as a SIMULATED
live transaction stream (default 1 per second) and raises an alert whenever
the model's fraud probability is above the tuned threshold.
"""
import asyncio
import json
import os
import sqlite3
import time
from contextlib import asynccontextmanager, closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE = Path(__file__).parent
DB_PATH = BASE / "alerts.db"
STREAM_INTERVAL = float(os.getenv("STREAM_INTERVAL", "1.0"))
HIGH_RISK = 0.80
VALID_STATUS = {"approved", "blocked", "escalated"}

state: Dict = {"processed": 0, "flagged": 0, "latency_ms_total": 0.0}
clients: List[WebSocket] = []


# ---------- database (SQLite) ----------
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with closing(db()) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            amount REAL NOT NULL,
            probability REAL NOT NULL,
            risk TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            actual_class INTEGER)""")
        conn.commit()


def row_to_dict(r: sqlite3.Row) -> dict:
    return dict(r)


# ---------- model ----------
def load_model():
    path = BASE / "model.joblib"
    if not path.exists():
        raise RuntimeError("model.joblib not found. Run `python train.py` first.")
    return joblib.load(path)


def risk_level(p: float, threshold: float) -> str:
    if p >= HIGH_RISK:
        return "high"
    if p >= threshold:
        return "medium"
    return "low"


def score_row(bundle: dict, row: dict) -> dict:
    cols = bundle["feature_cols"]
    missing = [c for c in cols if c not in row]
    if missing:
        raise HTTPException(422, f"Missing fields: {missing[:5]}...")
    t0 = time.perf_counter()
    frame = pd.DataFrame([[float(row[c]) for c in cols]], columns=cols)
    p = float(bundle["model"].predict_proba(frame)[0, 1])
    ms = (time.perf_counter() - t0) * 1000
    return {"probability": p, "risk": risk_level(p, bundle["threshold"]),
            "flagged": p >= bundle["threshold"], "latency_ms": ms}


# ---------- websocket broadcast ----------
async def broadcast(message: dict) -> None:
    dead = []
    for ws in clients:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in clients:
            clients.remove(ws)


# ---------- simulated live stream ----------
async def stream_task(app: FastAPI) -> None:
    sample_path = BASE / "data" / "stream_sample.csv"
    if not sample_path.exists():
        print("No data/stream_sample.csv, live stream disabled (run train.py).")
        return
    sample = pd.read_csv(sample_path)
    bundle = app.state.bundle
    cols = bundle["feature_cols"]
    i = 0
    while True:
        rec = sample.iloc[i % len(sample)]
        i += 1
        result = score_row(bundle, {c: rec[c] for c in cols})
        state["processed"] += 1
        state["latency_ms_total"] += result["latency_ms"]
        if result["flagged"]:
            state["flagged"] += 1
            with closing(db()) as conn:
                cur = conn.execute(
                    "INSERT INTO alerts (created_at, amount, probability, risk, actual_class) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (datetime.now(timezone.utc).isoformat(), float(rec["Amount"]),
                     result["probability"], result["risk"], int(rec["Class"])))
                conn.commit()
                alert = row_to_dict(conn.execute(
                    "SELECT * FROM alerts WHERE id=?", (cur.lastrowid,)).fetchone())
            await broadcast({"type": "alert", "alert": alert})
        await asyncio.sleep(STREAM_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.bundle = load_model()
    task = asyncio.create_task(stream_task(app))
    yield
    task.cancel()


app = FastAPI(title="FraudLens API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["*"], allow_headers=["*"])


# ---------- routes ----------
class StatusUpdate(BaseModel):
    status: str


@app.get("/health")
def health():
    return {"status": "ok", "threshold": app.state.bundle["threshold"]}


@app.get("/stats")
def stats():
    n = state["processed"]
    return {"processed": n, "flagged": state["flagged"],
            "avg_latency_ms": round(state["latency_ms_total"] / n, 3) if n else 0.0,
            "threshold": app.state.bundle["threshold"]}


@app.post("/score")
def score(txn: Dict[str, float]):
    return score_row(app.state.bundle, txn)


@app.get("/alerts")
def list_alerts(status: Optional[str] = None, limit: int = 200):
    q, args = "SELECT * FROM alerts", []
    if status:
        q += " WHERE status=?"
        args.append(status)
    q += " ORDER BY id DESC LIMIT ?"
    args.append(limit)
    with closing(db()) as conn:
        return [row_to_dict(r) for r in conn.execute(q, args).fetchall()]


@app.patch("/alerts/{alert_id}")
async def update_alert(alert_id: int, body: StatusUpdate):
    if body.status not in VALID_STATUS:
        raise HTTPException(422, f"status must be one of {sorted(VALID_STATUS)}")
    with closing(db()) as conn:
        cur = conn.execute("UPDATE alerts SET status=? WHERE id=?", (body.status, alert_id))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Alert not found")
        alert = row_to_dict(conn.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone())
    await broadcast({"type": "alert_updated", "alert": alert})
    return alert


@app.websocket("/ws/alerts")
async def ws_alerts(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        while True:
            await ws.receive_text()   # keep the connection open
    except WebSocketDisconnect:
        pass
    finally:
        if ws in clients:
            clients.remove(ws)
