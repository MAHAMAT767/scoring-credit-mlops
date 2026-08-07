"""
src/data_prep.py — Préparation et traitement des données.

Pipeline de préparation du dataset "Default of Credit Card Clients" :
  1. Chargement du CSV
  2. Nettoyage des catégories non documentées (EDUCATION, MARRIAGE)
  3. Feature engineering métier (utilisation du crédit, retards, ratios)
  4. Traitement conservateur des valeurs extrêmes
  5. Séparation train / test stratifiée

À lancer depuis backend/ :  python -m src.data_prep
"""

import sys
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from config import DATA_PATH, TARGET, ID_COL, RANDOM_STATE, TEST_SIZE

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PAY_COLS = ["PAY_1", "PAY_2", "PAY_3", "PAY_4", "PAY_5", "PAY_6"]
BILL_COLS = ["BILL_AMT1", "BILL_AMT2", "BILL_AMT3", "BILL_AMT4", "BILL_AMT5", "BILL_AMT6"]
PAYAMT_COLS = ["PAY_AMT1", "PAY_AMT2", "PAY_AMT3", "PAY_AMT4", "PAY_AMT5", "PAY_AMT6"]


def load_data() -> pd.DataFrame:
    """Charge le CSV brut et retire la colonne identifiant."""
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset introuvable : {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    if ID_COL in df.columns:
        df = df.drop(columns=[ID_COL])
    logger.info(f"Chargé : {df.shape[0]} lignes, {df.shape[1]} colonnes")
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Corrige les catégories non documentées du dataset :
      - EDUCATION : 0, 5, 6 -> 4 ("autres"), car non décrits dans la doc UCI
      - MARRIAGE  : 0       -> 3 ("autres")
    Et renomme PAY_0 en PAY_1 pour une numérotation cohérente PAY_1..PAY_6.
    """
    df = df.copy()

    if "PAY_0" in df.columns:
        df = df.rename(columns={"PAY_0": "PAY_1"})

    df["EDUCATION"] = df["EDUCATION"].replace({0: 4, 5: 4, 6: 4})
    df["MARRIAGE"] = df["MARRIAGE"].replace({0: 3})

    logger.info("Nettoyage : EDUCATION et MARRIAGE regroupés, PAY_0 -> PAY_1")
    return df


def _safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    """Division protégée contre les zéros et les infinis."""
    out = numerator / denominator.replace(0, np.nan)
    return out.replace([np.inf, -np.inf], np.nan).fillna(0)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Crée des variables métier interprétables à partir des colonnes brutes.
    Toutes ont un sens crédit clair, exploitable ensuite par SHAP/LIME.
    """
    df = df.copy()

    df["BILL_MEAN"] = df[BILL_COLS].mean(axis=1)
    df["PAYAMT_MEAN"] = df[PAYAMT_COLS].mean(axis=1)

    df["CREDIT_UTILIZATION"] = _safe_ratio(df["BILL_MEAN"], df["LIMIT_BAL"])

    df["PAYMENT_RATIO"] = _safe_ratio(df["PAYAMT_MEAN"], df["BILL_MEAN"])

    pay = df[PAY_COLS]
    df["N_MONTHS_DELAYED"] = (pay >= 1).sum(axis=1)
    df["MAX_DELAY"] = pay.max(axis=1).clip(lower=0)
    df["MEAN_PAY_STATUS"] = pay.mean(axis=1)

    df["LAST_BILL_RATIO"] = _safe_ratio(df["BILL_AMT1"], df["LIMIT_BAL"])

    df["EVER_DELAYED"] = (df["N_MONTHS_DELAYED"] > 0).astype(int)

    logger.info("Feature engineering : 8 variables métier créées")
    return df


def clip_outliers(df: pd.DataFrame, cols=None, lower_q=0.01, upper_q=0.99) -> pd.DataFrame:
    """
    Winsorisation (bornage) des colonnes monétaires plutôt que suppression
    de lignes : on écrête les valeurs extrêmes aux 1er/99e percentiles.

    Justification : supprimer des lignes supprimerait des clients en défaut
    (classe minoritaire, déjà rare à 22 %). Le bornage limite l'influence des
    valeurs aberrantes sans perdre d'information sur la cible.
    """
    df = df.copy()
    if cols is None:
        cols = BILL_COLS + PAYAMT_COLS + ["LIMIT_BAL"]
    for c in cols:
        lo, hi = df[c].quantile([lower_q, upper_q])
        df[c] = df[c].clip(lo, hi)
    logger.info(f"Valeurs extrêmes bornées (winsorisation) sur {len(cols)} colonnes")
    return df


def split_data(df: pd.DataFrame):
    """Séparation stratifiée pour préserver le taux de défaut dans les deux jeux."""
    X = df.drop(columns=[TARGET])
    y = df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )
    logger.info(
        f"Split : train={len(X_train)} (défaut {y_train.mean():.1%}) | "
        f"test={len(X_test)} (défaut {y_test.mean():.1%})"
    )
    return X_train, X_test, y_train, y_test


def prepare(clip: bool = True):
    """Exécute tout le pipeline de préparation et renvoie les splits."""
    df = load_data()
    df = clean_data(df)
    if clip:
        df = clip_outliers(df)
    df = build_features(df)
    return split_data(df)


if __name__ == "__main__":
    X_train, X_test, y_train, y_test = prepare()

    print("\n" + "=" * 60)
    print("ÉTAPE 2 — PRÉPARATION DES DONNÉES TERMINÉE")
    print("=" * 60)
    print(f"  Train : {X_train.shape[0]} lignes x {X_train.shape[1]} colonnes")
    print(f"  Test  : {X_test.shape[0]} lignes x {X_test.shape[1]} colonnes")
    print(f"  Taux de défaut (train) : {y_train.mean():.1%}")
    print(f"  Taux de défaut (test)  : {y_test.mean():.1%}")
    print("\n  Nouvelles features métier :")
    for c in ["CREDIT_UTILIZATION", "PAYMENT_RATIO", "N_MONTHS_DELAYED",
              "MAX_DELAY", "MEAN_PAY_STATUS", "LAST_BILL_RATIO",
              "EVER_DELAYED", "BILL_MEAN"]:
        print(f"    - {c}")
    print("=" * 60)