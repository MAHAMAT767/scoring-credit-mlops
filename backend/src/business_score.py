"""
src/business_score.py — Définition du score métier.

Contexte crédit :
  - Faux négatif (FN) : on accorde le crédit à un client qui fait DÉFAUT.
      -> perte du capital prêté. C'est l'erreur COÛTEUSE.
  - Faux positif (FP) : on refuse un BON client (qui aurait remboursé).
      -> manque à gagner sur les intérêts. Erreur moins coûteuse.

On pénalise donc un FN plus lourdement qu'un FP (ratio par défaut 5:1, cohérent
avec la matrice de coût classique du German Credit de l'UCI).

Le score métier sert à deux choses :
  1. Choisir le SEUIL de décision qui minimise le coût total (et non l'accuracy).
  2. Comparer les modèles entre eux via un scorer sklearn (GridSearchCV).
"""

import numpy as np
from sklearn.metrics import confusion_matrix, make_scorer

COST_FN = 5.0
COST_FP = 1.0


def business_cost(y_true, y_pred, cost_fn: float = COST_FN, cost_fp: float = COST_FP) -> float:
    """Coût total = cost_fn * (nb faux négatifs) + cost_fp * (nb faux positifs)."""
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return float(cost_fn * fn + cost_fp * fp)


def business_cost_per_client(y_true, y_pred, cost_fn: float = COST_FN,
                             cost_fp: float = COST_FP) -> float:
    """Coût moyen par client : permet de comparer des jeux de tailles différentes."""
    return business_cost(y_true, y_pred, cost_fn, cost_fp) / len(y_true)


def _positive_proba(y_proba) -> np.ndarray:
    """Retourne la proba de la classe positive, que l'entrée soit 1D ou 2D."""
    y_proba = np.asarray(y_proba)
    return y_proba[:, -1] if y_proba.ndim == 2 else y_proba


def optimal_threshold(y_true, y_proba, cost_fn: float = COST_FN,
                      cost_fp: float = COST_FP, n_steps: int = 101):
    """
    Balaie les seuils entre 0 et 1 et renvoie celui qui MINIMISE le coût métier.
    Retourne (seuil_optimal, cout_au_seuil_optimal).
    """
    proba = _positive_proba(y_proba)
    thresholds = np.linspace(0.01, 0.99, n_steps)
    costs = np.array([
        business_cost(y_true, (proba >= t).astype(int), cost_fn, cost_fp)
        for t in thresholds
    ])
    best = int(costs.argmin())
    return float(thresholds[best]), float(costs[best])


def _business_score_func(y_true, y_proba, cost_fn: float = COST_FN,
                         cost_fp: float = COST_FP) -> float:
    """
    Score utilisé par sklearn : coût métier minimal par client, au meilleur seuil.
    Plus il est bas, mieux c'est (d'où greater_is_better=False dans le scorer).
    """
    _, min_cost = optimal_threshold(y_true, y_proba, cost_fn, cost_fp)
    return min_cost / len(y_true)


# greater_is_better=False -> GridSearchCV cherchera à MINIMISER le coût.
business_scorer = make_scorer(
    _business_score_func,
    greater_is_better=False,
    response_method="predict_proba",
)


if __name__ == "__main__":
    print(f"Coûts : FN={COST_FN} | FP={COST_FP} (ratio {COST_FN/COST_FP:.0f}:1)")
    y_true = np.array([0, 0, 1, 1, 0, 1])
    y_pred = np.array([0, 1, 0, 1, 0, 1])
    print("Coût exemple :", business_cost(y_true, y_pred),
          "=", f"{COST_FN}*1(FN) + {COST_FP}*1(FP)")