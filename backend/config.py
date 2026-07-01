"""
config.py — Configuration centralisée du projet de scoring crédit.

Toutes les constantes (chemins, MLflow, dataset) sont définies ici pour
éviter de les dupliquer dans les différents scripts.
"""

from pathlib import Path

# ─── Chemins ────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent          # .../Exam/backend
DATA_DIR = BASE_DIR / "data"
DATA_PATH = DATA_DIR / "UCI_Credit_Card.csv"

# ─── MLflow (backend de suivi = SQLite) ─────────────────────────────────────
MLFLOW_DB = BASE_DIR / "mlflow.db"
# as_posix() -> chemin avec des "/" même sous Windows, requis par l'URI SQLite
MLFLOW_TRACKING_URI = f"sqlite:///{MLFLOW_DB.as_posix()}"
EXPERIMENT_NAME = "credit_scoring"

# ─── Dataset ────────────────────────────────────────────────────────────────
TARGET = "default.payment.next.month"   # cible : 1 = défaut, 0 = pas de défaut
ID_COL = "ID"                            # identifiant client (à retirer)
RANDOM_STATE = 42
TEST_SIZE = 0.2