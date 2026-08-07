"""
tests/test_api.py — Tests de l'API de scoring (pytest + TestClient).

Lancement (depuis backend/) :  pytest -v
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from api.main import app, MODEL

client = TestClient(app)

model_required = pytest.mark.skipif(
    MODEL is None, reason="modèle non entraîné (lancer src/train.py)"
)

CLIENT_RISQUE = {
    "LIMIT_BAL": 20000, "SEX": 2, "EDUCATION": 2, "MARRIAGE": 1, "AGE": 24,
    "PAY_1": 2, "PAY_2": 2, "PAY_3": 2, "PAY_4": 2, "PAY_5": 2, "PAY_6": 2,
    "BILL_AMT1": 19000, "BILL_AMT2": 18000, "BILL_AMT3": 17000,
    "BILL_AMT4": 16000, "BILL_AMT5": 15000, "BILL_AMT6": 14000,
    "PAY_AMT1": 0, "PAY_AMT2": 0, "PAY_AMT3": 0,
    "PAY_AMT4": 0, "PAY_AMT5": 0, "PAY_AMT6": 0,
}

CLIENT_SAIN = {
    "LIMIT_BAL": 200000, "SEX": 1, "EDUCATION": 1, "MARRIAGE": 2, "AGE": 40,
    "PAY_1": -1, "PAY_2": -1, "PAY_3": -1, "PAY_4": -1, "PAY_5": -1, "PAY_6": -1,
    "BILL_AMT1": 5000, "BILL_AMT2": 4000, "BILL_AMT3": 3000,
    "BILL_AMT4": 2000, "BILL_AMT5": 1000, "BILL_AMT6": 500,
    "PAY_AMT1": 5000, "PAY_AMT2": 4000, "PAY_AMT3": 3000,
    "PAY_AMT4": 2000, "PAY_AMT5": 1000, "PAY_AMT6": 500,
}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


@model_required
def test_predict_structure():
    r = client.post("/predict", json=CLIENT_RISQUE)
    assert r.status_code == 200
    body = r.json()
    assert 0.0 <= body["probability_default"] <= 1.0
    assert "decision" in body
    assert body["risk_level"] in {"faible", "modéré", "élevé"}


@model_required
def test_risky_client_higher_than_safe():
    """Le client à risque doit avoir une proba de défaut plus élevée que le client sain."""
    p_risque = client.post("/predict", json=CLIENT_RISQUE).json()["probability_default"]
    p_sain = client.post("/predict", json=CLIENT_SAIN).json()["probability_default"]
    assert p_risque > p_sain


def test_validation_error():
    """Un âge invalide doit être rejeté (422)."""
    bad = dict(CLIENT_SAIN, AGE=5)
    r = client.post("/predict", json=bad)
    assert r.status_code == 422