"""
config.py — Configuration centralisée du projet de scoring crédit.

Toutes les constantes (chemins, MLflow, dataset) sont définies ici pour
éviter de les dupliquer dans les différents scripts.
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_PATH = DATA_DIR / "UCI_Credit_Card.csv"

MLFLOW_DB = BASE_DIR / "mlflow.db"
MLFLOW_TRACKING_URI = f"sqlite:///{MLFLOW_DB.as_posix()}"
EXPERIMENT_NAME = "credit_scoring"

TARGET = "default.payment.next.month"
ID_COL = "ID"
RANDOM_STATE = 42
TEST_SIZE = 0.2