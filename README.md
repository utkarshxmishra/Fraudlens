# FraudLens - Real-Time Credit Card Fraud Monitoring

A full-stack fraud monitoring prototype. An XGBoost model scores a simulated stream of card
transactions, a FastAPI backend pushes high-risk alerts over WebSockets, and a Next.js analyst
dashboard lets a reviewer approve, block or escalate each alert.

> The live transaction stream is **simulated** by replaying held-out rows of the public Kaggle
> "Credit Card Fraud Detection" dataset. No real card data is used.

## Features
- XGBoost classifier for a highly imbalanced dataset (0.17% fraud) using class weighting
  (`scale_pos_weight`) and a decision threshold tuned from the precision-recall curve
- FastAPI REST API (`/score`, `/alerts`, `/stats`) and WebSocket stream (`/ws/alerts`)
- Alert workflow with status: pending / approved / blocked / escalated, stored in SQLite
- Next.js + TypeScript + Tailwind live dashboard with auto-reconnecting WebSocket, status filters,
  and live counters (transactions scored, average scoring time)

## Architecture
```
Simulated stream (1 txn/sec) -> FastAPI + XGBoost scoring -> SQLite (alerts)
                                         |
                                         +-> WebSocket /ws/alerts -> Next.js dashboard
Dashboard buttons -> PATCH /alerts/{id} -> status saved + broadcast to all viewers
```

## Project structure
```
FraudLens/
  backend/    train.py (model training), main.py (FastAPI app), requirements.txt
  frontend/   Next.js dashboard
  python.py   original logistic-regression baseline
```

## Run it locally

### 1. Backend
Download `creditcard.csv` from Kaggle and place it at `backend/data/creditcard.csv`.
```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
python train.py                  # trains the model, prints metrics, saves model.joblib
uvicorn main:app --reload        # API on http://localhost:8000  (docs at /docs)
```

### 2. Frontend (in a second terminal)
```bash
cd frontend
npm install
npm run dev                      # dashboard on http://localhost:3000
```
If the backend is not on `localhost:8000`, copy `.env.local.example` to `.env.local` and edit it.

## Deploy the dashboard to GitHub Pages

Push this repository to GitHub with the included `.github/workflows/deploy-pages.yml` file. In the
repository settings, open **Pages**, choose **GitHub Actions** as the source, and push to the
`main` or `master` branch. GitHub will build and publish the `frontend` dashboard automatically.

GitHub Pages cannot run the FastAPI backend or WebSocket stream, so the published site starts in
demo mode and remains fully viewable. To use live scoring, host the backend separately and set
`NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` in the workflow before the build.

## Results (held-out 20% test split)
Fill in the numbers printed by your own `python train.py` run:

| Metric | Value |
|---|---|
| Recall | _your value_ |
| Precision | _your value_ |
| PR-AUC | _your value_ |
| Avg scoring time | _shown on the dashboard_ |

Accuracy is deliberately not reported: predicting "not fraud" for every transaction is already
99.83% accurate, so precision, recall and PR-AUC are used instead.

## Screenshots
_Add a screenshot of the dashboard here (save it as `docs/dashboard.png`)._

## Tech stack
Python, XGBoost, scikit-learn, pandas, FastAPI, WebSockets, SQLite, Next.js, TypeScript, Tailwind CSS

## Roadmap
JWT authentication with analyst/admin roles, Redis caching, Docker Compose, LLM-generated alert
explanations, pytest tests and GitHub Actions CI.
# Fraudlens
