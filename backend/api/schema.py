"""
api/schema.py — Schémas Pydantic de l'API de scoring crédit.

ClientData  : les données brutes d'un client (entrée de /predict).
ScoreResponse : la réponse du modèle (proba de défaut + décision métier).
"""

from pydantic import BaseModel, Field


class ClientData(BaseModel):
    """Données brutes d'un client (colonnes du dataset UCI, hors ID et cible)."""
    LIMIT_BAL: float = Field(..., description="Limite de crédit accordée")
    SEX: int = Field(..., ge=1, le=2, description="1=homme, 2=femme")
    EDUCATION: int = Field(..., description="1=master, 2=université, 3=lycée, 4=autres")
    MARRIAGE: int = Field(..., description="1=marié, 2=célibataire, 3=autres")
    AGE: int = Field(..., ge=18, le=100)

    PAY_1: int
    PAY_2: int
    PAY_3: int
    PAY_4: int
    PAY_5: int
    PAY_6: int

    BILL_AMT1: float
    BILL_AMT2: float
    BILL_AMT3: float
    BILL_AMT4: float
    BILL_AMT5: float
    BILL_AMT6: float

    PAY_AMT1: float
    PAY_AMT2: float
    PAY_AMT3: float
    PAY_AMT4: float
    PAY_AMT5: float
    PAY_AMT6: float

    model_config = {
        "json_schema_extra": {
            "example": {
                "LIMIT_BAL": 20000, "SEX": 2, "EDUCATION": 2, "MARRIAGE": 1, "AGE": 24,
                "PAY_1": 2, "PAY_2": 2, "PAY_3": -1, "PAY_4": -1, "PAY_5": -2, "PAY_6": -2,
                "BILL_AMT1": 3913, "BILL_AMT2": 3102, "BILL_AMT3": 689,
                "BILL_AMT4": 0, "BILL_AMT5": 0, "BILL_AMT6": 0,
                "PAY_AMT1": 0, "PAY_AMT2": 689, "PAY_AMT3": 0,
                "PAY_AMT4": 0, "PAY_AMT5": 0, "PAY_AMT6": 0,
            }
        }
    }


class ScoreResponse(BaseModel):
    probability_default: float = Field(..., description="Probabilité de défaut [0-1]")
    threshold: float = Field(..., description="Seuil de décision métier")
    decision: str = Field(..., description="Décision recommandée")
    risk_level: str = Field(..., description="Niveau de risque (faible/modéré/élevé)")