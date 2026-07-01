"""
src/interpret.py — Étape 4 (interprétabilité) : SHAP + LIME.

Charge le modèle entraîné et produit :
  - SHAP : importance globale des variables (summary + bar plot) et top drivers
  - LIME : explication locale d'un client à risque
Les graphiques et insights sont sauvegardés et loggés dans MLflow.

À lancer depuis backend/ (après train.py) :  python -m src.interpret
"""

import sys
import json
import logging
from pathlib import Path
from datetime import datetime

import numpy as np
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import shap
import mlflow
from lime.lime_tabular import LimeTabularExplainer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import MLFLOW_TRACKING_URI, EXPERIMENT_NAME
from src.data_prep import prepare

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
SHAP_DIR = ARTIFACTS_DIR / "shap"
SHAP_DIR.mkdir(parents=True, exist_ok=True)


def load_model_and_meta():
    model = joblib.load(ARTIFACTS_DIR / "model.pkl")
    meta = json.loads((ARTIFACTS_DIR / "metadata.json").read_text(encoding="utf-8"))
    return model, meta


def split_pipeline(model):
    """Sépare le préprocesseur et le classifieur du pipeline imblearn."""
    preprocessor = model.named_steps["preprocessor"]
    clf = model.named_steps["model"]
    return preprocessor, clf


def run_shap(preprocessor, clf, X_train, X_test, n_sample=200):
    """Importance globale des variables via SHAP (TreeExplainer sur random forest)."""
    logger.info("Calcul SHAP...")
    feature_names = list(preprocessor.get_feature_names_out())
    X_test_t = preprocessor.transform(X_test)
    X_sample = X_test_t[:n_sample]

    explainer = shap.TreeExplainer(clf)
    shap_values = explainer.shap_values(X_sample)

    # Classe positive (défaut) selon le format retourné
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
    elif getattr(shap_values, "ndim", 2) == 3:
        shap_values = shap_values[:, :, 1]

    # 1. Summary plot
    plt.figure()
    shap.summary_plot(shap_values, X_sample, feature_names=feature_names,
                      show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(SHAP_DIR / "shap_summary.png", dpi=150, bbox_inches="tight")
    plt.close()

    # 2. Bar plot (importance moyenne absolue)
    plt.figure()
    shap.summary_plot(shap_values, X_sample, feature_names=feature_names,
                      plot_type="bar", show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(SHAP_DIR / "shap_bar.png", dpi=150, bbox_inches="tight")
    plt.close()

    # 3. Top drivers -> JSON
    mean_abs = np.abs(shap_values).mean(axis=0)
    order = np.argsort(mean_abs)[::-1][:10]
    top = [{
        "rank": i + 1,
        "feature": feature_names[idx],
        "importance": float(mean_abs[idx]),
        "direction": "augmente le risque" if shap_values[:, idx].mean() > 0
                     else "diminue le risque",
    } for i, idx in enumerate(order)]
    (SHAP_DIR / "shap_insights.json").write_text(
        json.dumps({"generated_at": datetime.now().isoformat(), "top_drivers": top},
                   indent=2, ensure_ascii=False))

    print("\n  TOP 5 VARIABLES (SHAP) :")
    for d in top[:5]:
        print(f"    {d['rank']}. {d['feature']:28} | {d['direction']}")
    return top


def run_lime(model, preprocessor, clf, X_train, X_test):
    """Explication locale LIME d'un client à haut risque."""
    logger.info("Calcul LIME...")
    feature_names = list(preprocessor.get_feature_names_out())
    X_train_t = np.asarray(preprocessor.transform(X_train))
    X_test_t = np.asarray(preprocessor.transform(X_test))

    explainer = LimeTabularExplainer(
        X_train_t,
        feature_names=feature_names,
        class_names=["pas de défaut", "défaut"],
        mode="classification",
        random_state=42,
    )

    # Choisir le client jugé le plus à risque par le modèle
    proba = clf.predict_proba(X_test_t)[:, 1]
    idx = int(np.argmax(proba))

    exp = explainer.explain_instance(
        X_test_t[idx], clf.predict_proba, num_features=10
    )

    # Figure LIME
    fig = exp.as_pyplot_figure()
    plt.tight_layout()
    fig.savefig(SHAP_DIR / "lime_explanation.png", dpi=150, bbox_inches="tight")
    plt.close(fig)

    lime_data = {
        "client_index": idx,
        "predicted_default_proba": float(proba[idx]),
        "contributions": [{"feature": f, "weight": float(w)} for f, w in exp.as_list()],
    }
    (SHAP_DIR / "lime_explanation.json").write_text(
        json.dumps(lime_data, indent=2, ensure_ascii=False))

    print(f"\n  LIME — client #{idx} (proba défaut = {proba[idx]:.1%}) :")
    for f, w in exp.as_list()[:5]:
        sens = "vers défaut" if w > 0 else "vers remboursement"
        print(f"    {f:40} {w:+.3f} ({sens})")
    return lime_data


def interpret():
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT_NAME)

    model, meta = load_model_and_meta()
    preprocessor, clf = split_pipeline(model)
    X_train, X_test, y_train, y_test = prepare()

    top = run_shap(preprocessor, clf, X_train, X_test)
    lime_data = run_lime(model, preprocessor, clf, X_train, X_test)

    # Log dans le run d'entraînement existant si disponible
    run_id = meta.get("mlflow_run_id")
    ctx = mlflow.start_run(run_id=run_id) if run_id else mlflow.start_run(run_name="interpret")
    with ctx:
        for f in ["shap_summary.png", "shap_bar.png", "shap_insights.json",
                  "lime_explanation.png", "lime_explanation.json"]:
            p = SHAP_DIR / f
            if p.exists():
                mlflow.log_artifact(str(p), artifact_path="interpretability")

    print("\n" + "=" * 64)
    print("ÉTAPE 4 (interprétabilité) — SHAP + LIME TERMINÉ")
    print("=" * 64)
    print(f"  Graphiques et insights dans : {SHAP_DIR}")
    print("=" * 64)
    return top, lime_data


if __name__ == "__main__":
    interpret()