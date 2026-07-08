"""
api/main.py — Étape 5 du TD : API REST de scoring crédit (FastAPI).

Endpoints :
  GET  /health   -> état de l'API et du modèle
  POST /predict  -> probabilité de défaut + décision métier pour un client
  POST /explain  -> contributions SHAP des variables pour ce client

Lancement (depuis backend/) :
  uvicorn api.main:app --reload --port 8000
"""

import os
import re
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

# Charge le fichier backend/.env (token Hugging Face) s'il existe
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def _load_json(path: Path):
    """Lit un JSON en tolérant l'encodage (UTF-8, ou Windows-1252 avec accents)."""
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            return json.loads(path.read_text(encoding=enc))
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    return json.loads(path.read_text(encoding="utf-8", errors="replace"))

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
_RAW_DF = None     # dataset brut, pour la recherche par ID


def _load_model():
    global MODEL, METADATA
    model_path = ARTIFACTS_DIR / "model.pkl"
    meta_path = ARTIFACTS_DIR / "metadata.json"
    if not model_path.exists():
        logger.warning("Modèle introuvable — lancez src/train.py d'abord.")
        return
    MODEL = joblib.load(model_path)
    METADATA = _load_json(meta_path) if meta_path.exists() else {}
    logger.info(f"Modèle chargé : {METADATA.get('model_name', '?')} "
                f"(seuil={METADATA.get('threshold', 0.5):.3f})")


# Chargement au moment de l'import (fonctionne avec uvicorn ET avec TestClient)
_load_model()


def _load_raw_dataset():
    """Charge le CSV brut pour permettre la recherche d'un client par son ID."""
    global _RAW_DF
    from config import DATA_PATH
    if DATA_PATH.exists():
        _RAW_DF = pd.read_csv(DATA_PATH)
        logger.info(f"Dataset brut chargé pour recherche par ID ({len(_RAW_DF)} clients)")


_load_raw_dataset()


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
@app.get("/client/{client_id}")
def get_client(client_id: int):
    """Récupère les données brutes d'un client du dataset à partir de son ID,
    ainsi que ce qui s'est réellement passé (défaut ou non)."""
    if _RAW_DF is None:
        raise HTTPException(status_code=503, detail="Dataset non disponible.")
    row = _RAW_DF[_RAW_DF["ID"] == client_id]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"Client {client_id} introuvable (IDs de 1 à {len(_RAW_DF)}).")
    r = row.iloc[0]

    # Regroupement des catégories non documentées pour un affichage propre
    edu = int(r["EDUCATION"]); edu = 4 if edu in (0, 5, 6) else edu
    mar = int(r["MARRIAGE"]);  mar = 3 if mar == 0 else mar

    data = {
        "LIMIT_BAL": float(r["LIMIT_BAL"]), "SEX": int(r["SEX"]),
        "EDUCATION": edu, "MARRIAGE": mar, "AGE": int(r["AGE"]),
        "PAY_1": int(r["PAY_0"]), "PAY_2": int(r["PAY_2"]), "PAY_3": int(r["PAY_3"]),
        "PAY_4": int(r["PAY_4"]), "PAY_5": int(r["PAY_5"]), "PAY_6": int(r["PAY_6"]),
        "BILL_AMT1": float(r["BILL_AMT1"]), "BILL_AMT2": float(r["BILL_AMT2"]),
        "BILL_AMT3": float(r["BILL_AMT3"]), "BILL_AMT4": float(r["BILL_AMT4"]),
        "BILL_AMT5": float(r["BILL_AMT5"]), "BILL_AMT6": float(r["BILL_AMT6"]),
        "PAY_AMT1": float(r["PAY_AMT1"]), "PAY_AMT2": float(r["PAY_AMT2"]),
        "PAY_AMT3": float(r["PAY_AMT3"]), "PAY_AMT4": float(r["PAY_AMT4"]),
        "PAY_AMT5": float(r["PAY_AMT5"]), "PAY_AMT6": float(r["PAY_AMT6"]),
    }
    return {
        "client_id": client_id,
        "client_data": data,
        "actual_default": int(r["default.payment.next.month"]),
    }


@app.get("/metrics")
def metrics():
    """Métriques du modèle et comparaisons (contenu de metadata.json)."""
    meta_path = ARTIFACTS_DIR / "metadata.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Métriques non disponibles (lancez src/train.py).")
    data = _load_json(meta_path)
    data["experiment_name"] = "credit_scoring"
    data["mlflow_backend"] = "sqlite:///mlflow.db"
    return data


@app.get("/drift")
def drift():
    """Résumé de l'analyse de dérive (contenu de drift_summary.json)."""
    p = BASE_DIR / "logs" / "monitoring" / "drift_summary.json"
    if not p.exists():
        raise HTTPException(status_code=404, detail="Rapport de drift non disponible (lancez src/drift.py).")
    return _load_json(p)


@app.get("/dataset-stats")
def dataset_stats():
    """Statistiques globales du dataset."""
    if _RAW_DF is None:
        raise HTTPException(status_code=503, detail="Dataset non disponible.")
    target = "default.payment.next.month"
    n = len(_RAW_DF)
    n_def = int(_RAW_DF[target].sum())
    return {"n_clients": n, "n_default": n_def,
            "default_rate": round(n_def / n, 4), "n_features": 23}


from pydantic import BaseModel


class ChatMsg(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMsg]
    client_id: int | None = None


def _client_context(cid: int) -> str:
    """Contexte d'un client : profil brut + prédiction + SHAP (accès données)."""
    if _RAW_DF is None:
        return ""
    row = _RAW_DF[_RAW_DF["ID"] == cid]
    if row.empty:
        return f"(Aucun client d'ID {cid} dans le dataset.)"
    def _d(x):
        return x.model_dump() if hasattr(x, "model_dump") else x
    try:
        lookup = get_client(cid)          # profil + issue réelle
        data = lookup["client_data"]
        score = _d(predict(ClientData(**data)))  # type: ignore[arg-type]
        exp = _d(explain(ClientData(**data)))    # type: ignore[arg-type]
        top = ", ".join(f"{c['feature']} ({c['contribution']:+.3f})"
                        for c in exp["top_contributions"][:5])
        return (
            f"\nDONNÉES DU CLIENT {cid} :\n"
            f"- Limite de crédit : {data['LIMIT_BAL']:.0f}, Âge : {data['AGE']}, "
            f"Statuts de paiement PAY_1..6 : {[data[f'PAY_{i}'] for i in range(1,7)]}\n"
            f"- Probabilité de défaut prédite : {score['probability_default']:.1%}\n"
            f"- Décision : {score['decision']} (seuil {score['threshold']:.1%})\n"
            f"- Facteurs SHAP principaux : {top}\n"
            f"- Issue réelle observée : "
            f"{'a fait défaut' if lookup['actual_default'] == 1 else 'a remboursé'}\n"
        )
    except Exception as e:  # noqa: BLE001
        return f"(Impossible de calculer le contexte du client {cid} : {e})"


def _system_prompt(cid: int | None) -> str:
    """Prompt système : rôle + accès aux métriques, au drift et au client."""
    meta_path = ARTIFACTS_DIR / "metadata.json"
    perf = ""
    if meta_path.exists():
        m = _load_json(meta_path)
        t = m["test_metrics"]
        perf = (f"Modèle : {m['model_name']} · ROC-AUC {t['roc_auc']:.3f} · "
                f"recall {t['recall']:.0%} · précision {t['precision']:.0%} · "
                f"coût métier {t['cost_per_client']:.3f}/client · seuil {m['threshold']:.1%}. "
                f"Coût FN = {m['cost_fn']}× coût FP.")
    drift_path = BASE_DIR / "logs" / "monitoring" / "drift_summary.json"
    drift = ""
    if drift_path.exists():
        d = _load_json(drift_path)
        dv = d["scenarios"]["derive"]
        drift = (f"Surveillance de dérive : en scénario dégradé, "
                 f"{dv['n_drifted']} variables dérivent et la probabilité de défaut "
                 f"monte de {dv['prediction_drift']['hausse_relative']:.0f}%.")
    ctx = _client_context(cid) if cid else ""
    return (
        "Tu es l'assistant analytique d'une application de scoring crédit (projet MLOps). "
        "Tu aides à interpréter les prédictions de défaut de paiement, les facteurs SHAP et "
        "les décisions d'octroi. Réponds en français, de façon concise et pédagogique. "
        "Ne donne jamais de conseil financier personnalisé : rappelle que la décision finale "
        "revient à un analyste humain.\n\n"
        f"CONNAISSANCES DISPONIBLES :\n{perf}\n{drift}\n{ctx}"
    )


@app.post("/chat")
def chat(req: ChatRequest):
    """Assistant conversationnel : appelle Hugging Face côté serveur.
    Le token reste sur le serveur (variable d'environnement HF_TOKEN)."""
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise HTTPException(status_code=503,
                            detail="Assistant non configuré : ajoutez HF_TOKEN dans backend/.env")

    # Détection d'un ID client dans le dernier message (accès aux données)
    cid = req.client_id
    if cid is None and req.messages:
        last = req.messages[-1].content
        found = re.findall(r"\b(\d{1,5})\b", last)
        if found:
            n = int(found[0])
            if 1 <= n <= (len(_RAW_DF) if _RAW_DF is not None else 30000):
                cid = n

    convo = [{"role": "system", "content": _system_prompt(cid)}]
    convo += [{"role": m.role, "content": m.content} for m in req.messages]

    model = os.environ.get("HF_MODEL", "meta-llama/Llama-3.1-8B-Instruct")
    try:
        from huggingface_hub import InferenceClient
        hf = InferenceClient(api_key=token)
        completion = hf.chat_completion(messages=convo, model=model,
                                        max_tokens=700, temperature=0.3)
        reponse = completion.choices[0].message.content
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502,
                            detail=f"Erreur Hugging Face : {e}")
    return {"reponse": reponse, "client_id": cid}


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