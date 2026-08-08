# 💳 Scoring Crédit — Système MLOps de bout en bout

[![CI](https://github.com/MAHAMAT767/scoring-credit-mlops/actions/workflows/ci.yml/badge.svg)](https://github.com/MAHAMAT767/scoring-credit-mlops/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![MLflow](https://img.shields.io/badge/MLflow-0194E2?logo=mlflow&logoColor=white)

Un système complet de **scoring crédit** qui aide une banque à décider d'accorder un prêt, en prédisant le risque de défaut d'un client. Le projet couvre tout le cycle de vie d'un modèle de machine learning : de la donnée brute jusqu'au déploiement cloud, avec interface web, assistant conversationnel et surveillance automatique en production.

🔗 **[Démo en ligne](https://scoring-credit-mlops.vercel.app)** · 🧠 API : [scoring-credit-mlops.onrender.com](https://scoring-credit-mlops.onrender.com)

---

## 🎯 Le problème

Une banque doit décider, à chaque demande, si elle accorde un crédit. Une mauvaise décision coûte cher : accorder un prêt à un client qui fait défaut fait perdre l'argent prêté. L'enjeu clé : **toutes les erreurs ne coûtent pas la même chose**. Rater un mauvais payeur coûte bien plus qu'un bon client refusé par erreur.

Ce projet répond à ce problème avec un modèle optimisé non pas sur le taux de bonnes réponses, mais sur le **coût métier réel** pour la banque. Un faux négatif (défaut non détecté) est pénalisé **5×** plus lourd qu'un faux positif (bon client refusé) — ratio cohérent avec la matrice de coût du German Credit de l'UCI.

> Optimiser l'*accuracy* ici serait trompeur : avec 22 % de défauts, un modèle qui prédit « aucun défaut » pour tout le monde atteindrait 78 % d'accuracy tout en étant sans valeur.

---

## 📊 Résultats clés

Modèle retenu : **Random Forest**, seuil de décision **38,2 %** (et non 50 %).

| Métrique | Valeur |
|---|---|
| Coût métier / client | **0,566** (baseline : 1,044) |
| **Réduction du coût de risque** | **−45,8 %** |
| Défauts détectés (recall) | **72,4 %** |
| Précision des alertes | 38,0 % |
| ROC-AUC | 0,777 |
| F1-score | 0,499 |

### Matrice de confusion (6 000 clients de test)

|  | Prédit : bon payeur | Prédit : défaut |
|---|---|---|
| **Réel : bon payeur** | 3 107 ✅ | 1 566 (fausses alertes) |
| **Réel : défaut** | 366 ⚠️ (défauts manqués) | 961 ✅ |

La précision de 38 % est **un choix assumé, pas une faiblesse** : le seuil a été abaissé volontairement pour attraper un maximum de défauts. On accepte davantage de fausses alertes (coût 1) afin de réduire les défauts manqués (coût 5), ce qui minimise le coût total.

### Comparaison des modèles (coût métier en validation croisée)

| Modèle | Coût métier CV | Retenu |
|---|---|---|
| **Random Forest** | **0,539** | ✅ |
| XGBoost | 0,545 | |
| Régression logistique | 0,565 | |
| Baseline (aléatoire stratifié) | 1,044 | |

### Gestion du déséquilibre : pondération vs SMOTE

| Approche | Coût / client |
|---|---|
| **Pondération des classes** (`class_weight`) | **0,566** ✅ |
| SMOTE (sur-échantillonnage synthétique) | 0,590 |

La pondération l'emporte sur ce jeu de données — SMOTE n'apporte rien ici, tout en alourdissant le pipeline.

---

## 📊 Données

Dataset public **UCI — Default of Credit Card Clients** : 30 000 clients, 23 variables, 22,1 % de défauts. Historique de paiement sur 6 mois, montants facturés et remboursés, profil client (âge, sexe, éducation, statut marital).

**Variables métier créées** (8, toutes interprétables) : taux d'utilisation du crédit, ratio de remboursement, nombre de mois en retard, retard maximal, statut de paiement moyen, ratio de la dernière facture, historique de retard, encours moyen.

Le *nombre de mois en retard* et le *statut du dernier mois* (`PAY_1`) ressortent comme les plus prédictifs.

---

## ⚙️ Démarche (7 étapes MLOps)

1. **Suivi des expériences** — MLflow (backend SQLite), paramètres, métriques et artefacts journalisés
2. **Préparation des données** — nettoyage des catégories non documentées, winsorisation des valeurs extrêmes (plutôt que suppression de lignes, qui détruirait la classe minoritaire), feature engineering métier
3. **Score métier** — fonction de coût asymétrique + scorer scikit-learn personnalisé
4. **Modélisation** — `GridSearchCV` optimisé sur le coût métier, seuil de décision calculé **hors échantillon** (validation croisée) pour éviter toute fuite de données
5. **API & déploiement** — FastAPI, Docker, CI/CD GitHub Actions, déploiement cloud
6. **Interface** — application React (dashboard, scoring client, assistant, paramètres)
7. **Monitoring** — détection de dérive (Evidently) et stratégie de réentraînement

---

## 📡 Surveillance de la dérive

32 variables surveillées, seuil d'alerte à 30 % de variables en dérive.

| Scénario | Variables en dérive | Proba de défaut moyenne | Décision |
|---|---|---|---|
| **Stable** (données de test) | 0 / 32 (0 %) | 0,408 → 0,407 | ✅ Pas de dérive |
| **Dégradé** (récession simulée) | 10 / 32 (31,2 %) | 0,408 → 0,518 **(+26,9 %)** | 🚨 Réentraînement recommandé |

Le scénario dégradé simule un choc économique (retards de paiement en hausse, utilisation du crédit accrue) : le monitoring le détecte bien et déclenche l'alerte, qui fait apparaître le bouton de réentraînement dans l'interface.

---

## 🧠 Interprétabilité

Le modèle n'est pas une boîte noire :

- **SHAP** — importance globale des variables et contribution détaillée pour chaque client, exposée via l'API et affichée dans l'interface
- **LIME** — explication locale d'une décision individuelle, utile pour justifier un refus (conformité RGPD : droit à l'explication)

---

## 🛠️ Stack technique

| Domaine | Technologies |
|---|---|
| **Machine Learning** | scikit-learn, XGBoost, imbalanced-learn (SMOTE) |
| **MLOps** | MLflow, Evidently |
| **Interprétabilité** | SHAP, LIME |
| **Backend** | FastAPI, Pydantic, Uvicorn |
| **Frontend** | React 19, TypeScript, Vite, TanStack Query, Recharts, Framer Motion |
| **Infra** | Docker, GitHub Actions |
| **Déploiement** | Render (API) · Vercel (interface) |

---

## 📁 Structure du projet

```
.
├── backend/                    # API, modèle et pipeline ML
│   ├── api/
│   │   ├── main.py             # Endpoints FastAPI
│   │   └── schema.py           # Schémas de validation Pydantic
│   ├── src/
│   │   ├── data_prep.py        # Nettoyage et feature engineering
│   │   ├── business_score.py   # Score métier (coût asymétrique)
│   │   ├── train.py            # Entraînement, comparaison, MLflow
│   │   ├── interpret.py        # SHAP et LIME
│   │   └── drift.py            # Détection de dérive (Evidently)
│   ├── artifacts/              # Modèle entraîné et métadonnées
│   ├── data/                   # Dataset UCI
│   ├── tests/                  # Tests de l'API (pytest)
│   ├── config.py               # Configuration centrale
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # Interface web (React + TypeScript)
│   └── src/
│       ├── pages/              # Dashboard, ScoringClient, Assistant, Parametres
│       ├── components/         # UI réutilisable + layout
│       ├── contexts/           # Thème clair/sombre
│       ├── api/client.ts       # Appels à l'API
│       └── types/              # Contrats de données partagés
│
└── .github/workflows/ci.yml    # Lint (ruff) + tests (pytest) à chaque push
```

---

## 🔌 API

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | État de l'API et du modèle chargé |
| `POST` | `/predict` | Probabilité de défaut + décision métier |
| `POST` | `/explain` | Contributions SHAP des variables |
| `GET` | `/client/{id}` | Profil d'un client du dataset + issue réelle |
| `GET` | `/metrics` | Métriques du modèle et comparaisons |
| `GET` | `/drift` | Résumé de l'analyse de dérive |
| `GET` | `/dataset-stats` | Statistiques globales du dataset |
| `POST` | `/chat` | Assistant conversationnel |
| `POST` | `/retrain` | Déclenche un réentraînement |
| `GET` | `/retrain-status` | Suivi du réentraînement en cours |

Documentation interactive auto-générée : **`/docs`** (Swagger UI).

### Exemple

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"LIMIT_BAL":20000,"SEX":2,"EDUCATION":2,"MARRIAGE":1,"AGE":24,
       "PAY_1":2,"PAY_2":2,"PAY_3":2,"PAY_4":2,"PAY_5":2,"PAY_6":2,
       "BILL_AMT1":19000,"BILL_AMT2":18000,"BILL_AMT3":17000,
       "BILL_AMT4":16000,"BILL_AMT5":15000,"BILL_AMT6":14000,
       "PAY_AMT1":0,"PAY_AMT2":0,"PAY_AMT3":0,
       "PAY_AMT4":0,"PAY_AMT5":0,"PAY_AMT6":0}'
```

```json
{
  "probability_default": 0.8838,
  "threshold": 0.3824,
  "decision": "Crédit refusé (risque de défaut)",
  "risk_level": "élevé"
}
```

---

## 🚀 Fonctionnalités de l'application

- **Tableau de bord** — métriques du modèle en langage clair, sans jargon ML
- **Scoring client** — recherche par ID, jauge de risque animée, facteurs SHAP détaillés, comparaison prédiction / issue réelle
- **Assistant** — interroge le modèle en langage naturel, analyse un client par son ID
- **Paramètres & monitoring** — suivi MLflow, surveillance de la dérive, bouton de réentraînement déclenché par l'alerte

---

## 📦 Installation locale

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows
# source venv/bin/activate       # Linux / macOS
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

API disponible sur `http://localhost:8000` · docs sur `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Interface sur `http://localhost:5173`

---

## 🔄 Relancer le pipeline complet

Depuis `backend/`, dans l'ordre :

```bash
python test_mlflow.py       # 1. Vérifie l'environnement MLflow
python -m src.data_prep     # 2. Prépare les données
python -m src.business_score  # 3. Démontre le score métier
python -m src.train         # 4. Entraîne et compare les modèles
python -m src.interpret     # 5. Génère SHAP et LIME
python -m src.drift         # 6. Analyse la dérive
```

Visualiser les expériences :

```bash
mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
```

---

## 🧪 Tests

```bash
cd backend
pip install pytest
pytest -v
```

La CI GitHub Actions exécute à chaque push un lint `ruff` (erreurs de syntaxe et noms non définis) puis la suite `pytest`. Les tests qui nécessitent le modèle entraîné sont automatiquement ignorés si l'artefact est absent.

---

## 🐳 Docker

```bash
cd backend
docker build -t scoring-credit-api .
docker run -p 8000:8000 scoring-credit-api
```

L'image lit la variable `PORT` (injectée par les plateformes cloud comme Render).

---

## 🔐 Variables d'environnement

| Variable | Où | Rôle |
|---|---|---|
| `HF_TOKEN` | `backend/.env` | Token Hugging Face de l'assistant (**reste côté serveur**) |
| `HF_MODEL` | `backend/.env` | Modèle utilisé (défaut : `meta-llama/Llama-3.1-8B-Instruct`) |
| `VITE_API_URL` | `frontend/.env` | URL de l'API (défaut : `http://localhost:8000`) |
| `PORT` | conteneur | Port d'écoute de l'API |

```env
# backend/.env
HF_TOKEN=votre_token
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct
```

Le token n'est **jamais** exposé au navigateur : le frontend n'appelle que l'endpoint `/chat` de notre propre API, qui relaie la requête côté serveur.

---

## ⚠️ Limites connues

- Le **réentraînement en ligne est simulé** : le conteneur de l'API n'a pas les ressources pour entraîner un modèle. En production, ce déclencheur appellerait un pipeline dédié (GitHub Actions / Airflow). En local, il s'exécute réellement.
- Le ratio de coût **5:1 est une hypothèse** issue de la littérature, pas des chiffres réels d'une banque.
- Le dataset date de 2005 (marché taïwanais) : les résultats ne sont pas transposables tels quels.
- L'API Render en offre gratuite peut mettre ~30 s à se réveiller après inactivité.

---

## 🔮 Améliorations envisagées

- Automatiser le réentraînement via un pipeline dédié (GitHub Actions / Airflow)
- Estimer non seulement *si* mais *quand* un client risque de faire défaut (analyse de survie)
- Calibrer le coût des erreurs avec les vrais montants de la banque
- Ajouter une authentification et une limitation de débit sur l'API

---

## 👤 Auteur

**Mahamat Haroun Ibrahim** — Master 2 Informatique de Gestion

