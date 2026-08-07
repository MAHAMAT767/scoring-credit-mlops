"""
src/drift.py — Étape 7 du TD : analyse du data drift avec Evidently.

Principe :
  - Référence = données d'entraînement (la distribution que le modèle a apprise).
  - Courant   = nouvelles données de production.
  On mesure si la distribution des variables a changé (dérive), on génère un
  rapport HTML, et on déclenche une ALERTE / recommandation de réentraînement
  selon la part de variables en dérive.

Deux scénarios de démonstration :
  1. "stable"  : données de test (même distribution) -> pas d'alerte attendue.
  2. "dérive"  : portefeuille dégradé (retards de paiement en hausse, comme en
                 récession) -> le monitoring doit détecter la dérive.

À lancer depuis backend/ :  python -m src.drift
"""

import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
import joblib
from evidently import Report
from evidently.presets import DataDriftPreset

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.data_prep import prepare

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
MONITORING_DIR = BASE_DIR / "logs" / "monitoring"
MONITORING_DIR.mkdir(parents=True, exist_ok=True)

DRIFT_THRESHOLD = 0.30

PAY_COLS = ["PAY_1", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6"]


def simulate_drift(X: pd.DataFrame) -> pd.DataFrame:
    """
    Simule une dérive réaliste : dégradation du comportement de paiement
    (retards en hausse) et utilisation du crédit accrue, comme lors d'un choc
    économique. Sert à prouver que le monitoring détecte bien la dérive.
    """
    Xd = X.copy()
    for c in PAY_COLS:
        if c in Xd.columns:
            Xd[c] = Xd[c] + 1
    if "N_MONTHS_DELAYED" in Xd.columns:
        Xd["N_MONTHS_DELAYED"] = (Xd["N_MONTHS_DELAYED"] + 1).clip(upper=6)
    if "MAX_DELAY" in Xd.columns:
        Xd["MAX_DELAY"] = (Xd["MAX_DELAY"] + 1).clip(upper=8)
    if "CREDIT_UTILIZATION" in Xd.columns:
        Xd["CREDIT_UTILIZATION"] = Xd["CREDIT_UTILIZATION"] * 1.25
    if "EVER_DELAYED" in Xd.columns:
        Xd["EVER_DELAYED"] = 1
    return Xd


def run_drift_report(reference: pd.DataFrame, current: pd.DataFrame, tag: str) -> dict:
    """Lance Evidently, sauvegarde le rapport HTML et renvoie un résumé chiffré."""
    report = Report(metrics=[DataDriftPreset()])
    snapshot = report.run(current_data=current, reference_data=reference)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    html_path = MONITORING_DIR / f"data_drift_{tag}_{stamp}.html"
    snapshot.save_html(str(html_path))

    result = snapshot.dict()
    drift = result["metrics"][0]["value"]
    n_drifted = int(drift["count"])
    share = float(drift["share"])

    return {"tag": tag, "n_drifted": n_drifted, "drift_share": share,
            "html_report": str(html_path)}


def prediction_drift(reference: pd.DataFrame, current: pd.DataFrame) -> dict:
    """Compare la distribution des probabilités de défaut prédites (ref vs courant)."""
    model_path = ARTIFACTS_DIR / "model.pkl"
    if not model_path.exists():
        return {}
    model = joblib.load(model_path)
    p_ref = model.predict_proba(reference)[:, 1].mean()
    p_cur = model.predict_proba(current)[:, 1].mean()
    return {"proba_defaut_reference": round(float(p_ref), 4),
            "proba_defaut_courant": round(float(p_cur), 4),
            "hausse_relative": round(float((p_cur - p_ref) / p_ref * 100), 1)}


def decide(summary: dict) -> str:
    if summary["drift_share"] >= DRIFT_THRESHOLD:
        return "ALERTE : dérive significative -> réentraînement recommandé"
    if summary["drift_share"] > 0:
        return "Vigilance : dérive partielle -> surveiller de près"
    return "OK : pas de dérive détectée"


def monitor():
    X_train, X_test, y_train, y_test = prepare()
    reference = X_train

    logger.info("Scénario 1 : données stables (test)")
    stable = run_drift_report(reference, X_test, "stable")
    stable["decision"] = decide(stable)
    stable["prediction_drift"] = prediction_drift(reference, X_test)

    logger.info("Scénario 2 : portefeuille dégradé (dérive simulée)")
    drifted_data = simulate_drift(X_test)
    drifted = run_drift_report(reference, drifted_data, "derive")
    drifted["decision"] = decide(drifted)
    drifted["prediction_drift"] = prediction_drift(reference, drifted_data)

    summary = {
        "generated_at": datetime.now().isoformat(),
        "drift_threshold": DRIFT_THRESHOLD,
        "n_features_monitored": reference.shape[1],
        "scenarios": {"stable": stable, "derive": drifted},
    }
    (MONITORING_DIR / "drift_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    print("\n" + "=" * 66)
    print("ÉTAPE 7 — ANALYSE DU DATA DRIFT")
    print("=" * 66)
    print(f"  Variables surveillées : {reference.shape[1]}")
    print(f"  Seuil d'alerte        : {int(DRIFT_THRESHOLD*100)} % de variables en dérive")
    for tag, s in [("STABLE", stable), ("DÉRIVE", drifted)]:
        print("-" * 66)
        print(f"  [{tag}]")
        print(f"    Variables en dérive : {s['n_drifted']}/{reference.shape[1]} "
              f"({s['drift_share']*100:.0f} %)")
        pd_ = s["prediction_drift"]
        if pd_:
            print(f"    Proba défaut moy.   : {pd_['proba_defaut_reference']:.3f} "
                  f"-> {pd_['proba_defaut_courant']:.3f} "
                  f"({pd_['hausse_relative']:+.0f} %)")
        print(f"    Décision            : {s['decision']}")
    print("=" * 66)
    print(f"  Rapports HTML : {MONITORING_DIR}")
    print("=" * 66)
    return summary


if __name__ == "__main__":
    monitor()