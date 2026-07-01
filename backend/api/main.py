"""
api/main.py — Étape 5 du TD : API REST de scoring crédit (FastAPI).

Endpoints :
  GET  /health   -> état de l'API et du modèle
  POST /predict  -> probabilité de défaut + décision métier pour un client
  POST /explain  -> contributions SHAP des variables pour ce client

Lancement (depuis backend/) :
  uvicorn api.main:app --reload --port 8000
"""

import sys
import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from src.data_prep import clean_data, build_features
from api.schema import ClientData, ScoreResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"

# ─── Application ────────────────────────────────────────────────────────────
app = FastAPI(
    title="API de scoring crédit",
    description="Prédit le risque de défaut de paiement d'un client.",
    version="1.0.0",
)

# CORS : autorise le front React (Vite = 5173, CRA = 3000) à appeler l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Chargement du modèle au démarrage ──────────────────────────────────────
MODEL = None
METADATA = {}
_EXPLAINER = None  # SHAP, chargé paresseusement


def _load_model():
    global MODEL, METADATA
    model_path = ARTIFACTS_DIR / "model.pkl"
    meta_path = ARTIFACTS_DIR / "metadata.json"
    if not model_path.exists():
        logger.warning("Modèle introuvable — lancez src/train.py d'abord.")
        return
    MODEL = joblib.load(model_path)
    METADATA = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    logger.info(f"Modèle chargé : {METADATA.get('model_name', '?')} "
                f"(seuil={METADATA.get('threshold', 0.5):.3f})")


# Chargement au moment de l'import (fonctionne avec uvicorn ET avec TestClient)
_load_model()


# ─── Préparation des features (mêmes transformations qu'à l'entraînement) ────
def _prepare_one(data: ClientData) -> pd.DataFrame:
    df = pd.DataFrame([data.model_dump()])
    df = clean_data(df)       # remap EDUCATION/MARRIAGE
    df = build_features(df)   # features métier
    return df


def _risk_level(p: float) -> str:
    if p < 0.20:
        return "faible"
    if p < 0.50:
        return "modéré"
    return "élevé"


# ─── Endpoints ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": MODEL is not None,
        "model_name": METADATA.get("model_name"),
        "threshold": METADATA.get("threshold"),
    }


@app.post("/predict", response_model=ScoreResponse)
def predict(data: ClientData):
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé.")
    X = _prepare_one(data)
    proba = float(MODEL.predict_proba(X)[:, 1][0])
    threshold = float(METADATA.get("threshold", 0.5))
    is_default = proba >= threshold
    return ScoreResponse(
        probability_default=round(proba, 4),
        threshold=round(threshold, 4),
        decision="Crédit refusé (risque de défaut)" if is_default else "Crédit accordé",
        risk_level=_risk_level(proba),
    )


@app.post("/explain")
def explain(data: ClientData):
    """Contributions SHAP des variables pour ce client (pour le front React)."""
    global _EXPLAINER
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Modèle non chargé.")
    import shap

    preprocessor = MODEL.named_steps["preprocessor"]
    clf = MODEL.named_steps["model"]
    feature_names = list(preprocessor.get_feature_names_out())

    X = _prepare_one(data)
    X_t = preprocessor.transform(X)

    if _EXPLAINER is None:
        _EXPLAINER = shap.TreeExplainer(clf)
    sv = _EXPLAINER.shap_values(X_t)
    if isinstance(sv, list):
        sv = sv[1]
    elif getattr(sv, "ndim", 2) == 3:
        sv = sv[:, :, 1]
    sv = np.asarray(sv)[0]

    contribs = sorted(
        [{"feature": f, "contribution": float(v)} for f, v in zip(feature_names, sv)],
        key=lambda d: abs(d["contribution"]), reverse=True,
    )[:10]
    return {"top_contributions": contribs}