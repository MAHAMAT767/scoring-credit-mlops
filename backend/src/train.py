"""
src/train.py — Étape 4 du TD : entraînement et comparaison de modèles.

Contenu :
  - Baseline (DummyClassifier) + LogisticRegression + RandomForest + XGBoost
  - GridSearchCV optimisé sur le SCORE MÉTIER (business_scorer)
  - Gestion du déséquilibre : class_weight/scale_pos_weight, puis comparaison
    avec SMOTE sur le meilleur modèle
  - Seuil de décision optimal calculé hors échantillon (sans fuite de données)
  - Tracking complet dans MLflow (params, métriques techniques + métier, artefacts)
  - Sauvegarde du meilleur modèle et de ses métadonnées

À lancer depuis backend/ :  python -m src.train
"""

import sys
import json
import logging
import warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import joblib
import mlflow
import mlflow.sklearn
from mlflow.models.signature import infer_signature

from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_val_predict
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score, recall_score, confusion_matrix
)
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import (MLFLOW_TRACKING_URI, EXPERIMENT_NAME, RANDOM_STATE)
from src.data_prep import prepare
from src.business_score import (
    business_cost, business_cost_per_client, optimal_threshold,
    business_scorer, COST_FN, COST_FP
)

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
ARTIFACTS_DIR.mkdir(exist_ok=True)

CATEGORICAL = ["SEX", "EDUCATION", "MARRIAGE"]

CV = StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)


def build_preprocessor(X):
    cat = [c for c in CATEGORICAL if c in X.columns]
    num = [c for c in X.columns if c not in cat]
    return ColumnTransformer([
        ("num", StandardScaler(), num),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat),
    ])


def make_pipeline(X, model, use_smote=False):
    """Assemble préprocesseur (+ SMOTE optionnel) + modèle dans un pipeline imblearn."""
    steps = [("preprocessor", build_preprocessor(X))]
    if use_smote:
        steps.append(("smote", SMOTE(random_state=RANDOM_STATE)))
    steps.append(("model", model))
    return ImbPipeline(steps)


def get_candidates(scale_pos_weight):
    """Modèles avec gestion du déséquilibre par pondération, + petites grilles."""
    return {
        "logreg": (
            LogisticRegression(max_iter=1000, class_weight="balanced",
                               random_state=RANDOM_STATE),
            {"model__C": [0.1, 1.0]},
        ),
        "rf": (
            RandomForestClassifier(class_weight="balanced", n_jobs=-1,
                                   random_state=RANDOM_STATE),
            {"model__n_estimators": [200], "model__max_depth": [6, 10]},
        ),
        "xgb": (
            XGBClassifier(scale_pos_weight=scale_pos_weight, eval_metric="logloss",
                          n_jobs=-1, random_state=RANDOM_STATE),
            {"model__max_depth": [3, 5], "model__n_estimators": [200],
             "model__learning_rate": [0.1]},
        ),
    }


def evaluate_at_threshold(y_true, y_proba, threshold):
    y_pred = (y_proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "roc_auc":   float(roc_auc_score(y_true, y_proba)),
        "f1":        float(f1_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall":    float(recall_score(y_true, y_pred)),
        "business_cost":      business_cost(y_true, y_pred),
        "cost_per_client":    business_cost_per_client(y_true, y_pred),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def train():
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT_NAME)

    X_train, X_test, y_train, y_test = prepare()
    scale_pos_weight = float((y_train == 0).sum() / (y_train == 1).sum())
    logger.info(f"scale_pos_weight (XGBoost) = {scale_pos_weight:.2f}")

    with mlflow.start_run(run_name=f"train_{datetime.now():%Y%m%d_%H%M%S}") as run:
        run_id = run.info.run_id
        mlflow.log_params({
            "cost_fn": COST_FN, "cost_fp": COST_FP,
            "random_state": RANDOM_STATE,
            "train_size": len(X_train), "test_size": len(X_test),
        })

        dummy = DummyClassifier(strategy="stratified", random_state=RANDOM_STATE)
        dummy.fit(X_train, y_train)
        base_proba = dummy.predict_proba(X_test)[:, 1]
        base_metrics = evaluate_at_threshold(y_test, base_proba, 0.5)
        mlflow.log_metric("baseline_roc_auc", round(base_metrics["roc_auc"], 4))
        mlflow.log_metric("baseline_cost_per_client", round(base_metrics["cost_per_client"], 4))
        logger.info(f"Baseline : ROC-AUC={base_metrics['roc_auc']:.3f} "
                    f"coût/client={base_metrics['cost_per_client']:.3f}")

        results = {}
        for name, (model, grid) in get_candidates(scale_pos_weight).items():
            pipe = make_pipeline(X_train, model, use_smote=False)
            gs = GridSearchCV(pipe, grid, scoring=business_scorer, cv=CV, n_jobs=-1)
            gs.fit(X_train, y_train)
            cv_cost = -gs.best_score_
            results[name] = {"estimator": gs.best_estimator_,
                             "params": gs.best_params_, "cv_cost": cv_cost}
            mlflow.log_metric(f"cv_cost_{name}", round(cv_cost, 4))
            logger.info(f"  {name:7} | coût métier CV = {cv_cost:.4f} | {gs.best_params_}")

        best_name = min(results, key=lambda k: results[k]["cv_cost"])
        best_model = results[best_name]["estimator"]
        mlflow.log_param("best_model", best_name)
        logger.info(f"Meilleur modèle : {best_name}")

        oof_proba = cross_val_predict(best_model, X_train, y_train, cv=CV,
                                      method="predict_proba")[:, 1]
        threshold, _ = optimal_threshold(y_train, oof_proba)
        logger.info(f"Seuil optimal (hors échantillon) = {threshold:.3f}")

        test_proba = best_model.predict_proba(X_test)[:, 1]
        metrics = evaluate_at_threshold(y_test, test_proba, threshold)
        mlflow.log_metric("threshold", round(threshold, 4))
        mlflow.log_metrics({
            "roc_auc": round(metrics["roc_auc"], 4),
            "f1": round(metrics["f1"], 4),
            "precision": round(metrics["precision"], 4),
            "recall": round(metrics["recall"], 4),
            "business_cost": round(metrics["business_cost"], 2),
            "cost_per_client": round(metrics["cost_per_client"], 4),
            "fn": metrics["fn"], "fp": metrics["fp"],
            "tn": metrics["tn"], "tp": metrics["tp"],
        })

        smote_model = make_pipeline(
            X_train,
            get_candidates(scale_pos_weight)[best_name][0],
            use_smote=True,
        )
        smote_model.fit(X_train, y_train)
        smote_proba = smote_model.predict_proba(X_test)[:, 1]
        t_smote, _ = optimal_threshold(y_train,
                        cross_val_predict(smote_model, X_train, y_train, cv=CV,
                                          method="predict_proba")[:, 1])
        smote_metrics = evaluate_at_threshold(y_test, smote_proba, t_smote)
        mlflow.log_metric("smote_cost_per_client", round(smote_metrics["cost_per_client"], 4))
        logger.info(f"Déséquilibre — pondération: {metrics['cost_per_client']:.4f} | "
                    f"SMOTE: {smote_metrics['cost_per_client']:.4f} (coût/client)")

        joblib.dump(best_model, ARTIFACTS_DIR / "model.pkl")
        metadata = {
            "model_name": best_name,
            "threshold": float(threshold),
            "cost_fn": COST_FN, "cost_fp": COST_FP,
            "mlflow_run_id": run_id,
            "trained_at": datetime.now().isoformat(),
            "test_metrics": metrics,
            "baseline_cost_per_client": base_metrics["cost_per_client"],
            "imbalance_comparison": {
                "class_weight_cost": metrics["cost_per_client"],
                "smote_cost": smote_metrics["cost_per_client"],
            },
            "cv_costs": {k: v["cv_cost"] for k, v in results.items()},
        }
        (ARTIFACTS_DIR / "metadata.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False))

        signature = infer_signature(X_train.head(), best_model.predict_proba(X_train.head()))
        try:
            mlflow.sklearn.log_model(
                best_model, name="model", signature=signature,
                serialization_format="cloudpickle",
            )
        except Exception as e:
            logger.warning(f"log_model indisponible ({type(e).__name__}), repli sur artefact joblib")
            mlflow.log_artifact(str(ARTIFACTS_DIR / "model.pkl"), artifact_path="model")
        mlflow.log_artifact(str(ARTIFACTS_DIR / "metadata.json"), artifact_path="metadata")

        print("\n" + "=" * 64)
        print("ÉTAPE 4 — COMPARAISON DE MODÈLES")
        print("=" * 64)
        print(f"  Baseline    coût/client : {base_metrics['cost_per_client']:.3f}")
        for name, r in sorted(results.items(), key=lambda x: x[1]["cv_cost"]):
            mark = "  <-- retenu" if name == best_name else ""
            print(f"  {name:7}  coût métier CV : {r['cv_cost']:.3f}{mark}")
        print("-" * 64)
        print(f"  Modèle retenu : {best_name}  (seuil={threshold:.3f})")
        print(f"  ROC-AUC={metrics['roc_auc']:.3f} | Recall={metrics['recall']:.3f} | "
              f"Precision={metrics['precision']:.3f} | F1={metrics['f1']:.3f}")
        print(f"  FN={metrics['fn']} FP={metrics['fp']} TN={metrics['tn']} TP={metrics['tp']}")
        print(f"  Coût métier/client : {metrics['cost_per_client']:.3f} "
              f"(baseline {base_metrics['cost_per_client']:.3f})")
        print(f"  Déséquilibre — pondération {metrics['cost_per_client']:.3f} "
              f"vs SMOTE {smote_metrics['cost_per_client']:.3f}")
        print("=" * 64)
        return metadata


if __name__ == "__main__":
    train()