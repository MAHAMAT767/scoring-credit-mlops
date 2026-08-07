"""
test_mlflow.py — Étape 1 du TD : test de journalisation MLflow.

Objectif : vérifier que le backend de suivi (SQLite) fonctionne en loggant
une expérience simple avec des paramètres, des métriques et un artefact.
À lancer depuis le dossier backend/ :  python test_mlflow.py
"""

from pathlib import Path

import mlflow

from config import MLFLOW_TRACKING_URI, EXPERIMENT_NAME, RANDOM_STATE


def main() -> str:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment(EXPERIMENT_NAME)

    with mlflow.start_run(run_name="test_setup_etape1") as run:
        mlflow.log_param("dataset", "UCI_Credit_Card")
        mlflow.log_param("random_state", RANDOM_STATE)
        mlflow.log_param("objectif", "verification_environnement")

        mlflow.log_metric("n_clients", 30000)
        mlflow.log_metric("taux_defaut", 0.221)
        mlflow.log_metric("baseline_accuracy", 0.779)

        artifact = Path("mlflow_test_artifact.txt")
        artifact.write_text(
            "Etape 1 - Environnement MLflow operationnel.\n"
            "Backend de suivi : SQLite (mlflow.db)\n",
            encoding="utf-8",
        )
        mlflow.log_artifact(str(artifact))
        artifact.unlink()

        run_id = run.info.run_id

    print("\n" + "=" * 60)
    print("ETAPE 1 - JOURNALISATION MLFLOW REUSSIE")
    print("=" * 60)
    print(f"  Experience   : {EXPERIMENT_NAME}")
    print(f"  run_id       : {run_id}")
    print(f"  Tracking URI : {mlflow.get_tracking_uri()}")
    print("=" * 60)
    print("\nPour visualiser dans l'interface MLflow :")
    print("  mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000")
    print("  puis ouvrir http://localhost:5000\n")

    return run_id


if __name__ == "__main__":
    main()