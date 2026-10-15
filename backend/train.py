"""Train the FraudLens fraud model (XGBoost) and save it for the API.

Usage (from the backend/ folder):
    python train.py
    python train.py --data path/to/creditcard.csv

Steps:
  1. Load the Kaggle credit card fraud dataset.
  2. Stratified 80/20 train/test split (keeps the 0.17% fraud ratio in both).
  3. Train XGBoost with class weighting (scale_pos_weight) for the imbalance.
  4. Choose the decision threshold from the precision-recall curve
     (highest recall while keeping precision above --min-precision).
  5. Print precision / recall / F1 / PR-AUC / confusion matrix.
  6. Save model.joblib and a small replay file (data/stream_sample.csv)
     built from the TEST split, which the API uses to simulate live traffic.
"""
import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (average_precision_score, confusion_matrix,
                             f1_score, precision_recall_curve,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

BASE = Path(__file__).parent
TARGET = "Class"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(BASE / "data" / "creditcard.csv"))
    parser.add_argument("--min-precision", type=float, default=0.30,
                        help="threshold = highest recall with precision >= this")
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        raise SystemExit(f"Dataset not found: {data_path}\n"
                         "Download creditcard.csv from Kaggle and put it in backend/data/")

    df = pd.read_csv(data_path)
    feature_cols = [c for c in df.columns if c != TARGET]
    X, y = df[feature_cols], df[TARGET]
    print(f"Transactions: {len(df):,} | Fraud: {int(y.sum()):,} ({y.mean():.3%})")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y)

    # Class weighting: fraud mistakes cost ~ (legit / fraud) times more.
    spw = (y_train == 0).sum() / (y_train == 1).sum()
    model = XGBClassifier(
        n_estimators=300, max_depth=5, learning_rate=0.1,
        subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=spw, eval_metric="aucpr",
        tree_method="hist", n_jobs=-1, random_state=42)
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]

    # Threshold tuning from the precision-recall curve.
    prec, rec, thr = precision_recall_curve(y_test, proba)
    prec, rec = prec[:-1], rec[:-1]            # align with thresholds
    ok = prec >= args.min_precision
    if ok.any():
        best = np.where(ok)[0][np.argmax(rec[ok])]
    else:
        best = int(np.argmax(2 * prec * rec / (prec + rec + 1e-12)))
    threshold = float(thr[best])
    pred = (proba >= threshold).astype(int)

    print("\n--- Test-set results ---")
    print(f"Chosen threshold : {threshold:.4f} (default 0.5 is NOT used)")
    print(f"ROC-AUC          : {roc_auc_score(y_test, proba):.4f}")
    print(f"PR-AUC (avg prec): {average_precision_score(y_test, proba):.4f}")
    print(f"Precision        : {precision_score(y_test, pred):.4f}")
    print(f"Recall           : {recall_score(y_test, pred):.4f}")
    print(f"F1               : {f1_score(y_test, pred):.4f}")
    tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
    print(f"Confusion matrix : TN={tn} FP={fp} FN={fn} TP={tp}")
    print("\nWhy not accuracy? Predicting 'not fraud' for everything is already "
          f"{1 - y.mean():.2%} accurate, so accuracy hides the fraud we care about.")

    joblib.dump({"model": model, "threshold": threshold,
                 "feature_cols": feature_cols}, BASE / "model.joblib")

    # Replay file for the live-stream simulation (test rows only).
    test = X_test.copy()
    test[TARGET] = y_test.values
    sample = pd.concat([
        test[test[TARGET] == 1],
        test[test[TARGET] == 0].sample(n=min(3000, int((test[TARGET] == 0).sum())), random_state=1),
    ]).sample(frac=1, random_state=7)
    (BASE / "data").mkdir(exist_ok=True)
    sample.to_csv(BASE / "data" / "stream_sample.csv", index=False)
    print(f"\nSaved model.joblib and data/stream_sample.csv ({len(sample):,} rows)")


if __name__ == "__main__":
    main()
