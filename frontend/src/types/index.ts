// src/types/index.ts — Contrat de données partagé avec l'API FastAPI.

export interface ClientData {
  LIMIT_BAL: number;
  SEX: number;
  EDUCATION: number;
  MARRIAGE: number;
  AGE: number;
  PAY_1: number; PAY_2: number; PAY_3: number;
  PAY_4: number; PAY_5: number; PAY_6: number;
  BILL_AMT1: number; BILL_AMT2: number; BILL_AMT3: number;
  BILL_AMT4: number; BILL_AMT5: number; BILL_AMT6: number;
  PAY_AMT1: number; PAY_AMT2: number; PAY_AMT3: number;
  PAY_AMT4: number; PAY_AMT5: number; PAY_AMT6: number;
}

export interface ScoreResponse {
  probability_default: number;
  threshold: number;
  decision: string;
  risk_level: "faible" | "modéré" | "élevé";
}

export interface Contribution {
  feature: string;
  contribution: number;
}

export interface ExplainResponse {
  top_contributions: Contribution[];
}

export interface ClientLookup {
  client_id: number;
  client_data: ClientData;
  actual_default: number; // 0 = a remboursé, 1 = a fait défaut
}

export interface TestMetrics {
  roc_auc: number; f1: number; precision: number; recall: number;
  business_cost: number; cost_per_client: number;
  tn: number; fp: number; fn: number; tp: number;
}

export interface Metrics {
  model_name: string;
  threshold: number;
  cost_fn: number;
  cost_fp: number;
  mlflow_run_id: string;
  trained_at: string;
  test_metrics: TestMetrics;
  baseline_cost_per_client: number;
  imbalance_comparison: { class_weight_cost: number; smote_cost: number };
  cv_costs: Record<string, number>;
  experiment_name: string;
  mlflow_backend: string;
}

export interface DatasetStats {
  n_clients: number; n_default: number; default_rate: number; n_features: number;
}

export interface DriftScenario {
  n_drifted: number; drift_share: number; decision: string;
  prediction_drift: { proba_defaut_reference: number; proba_defaut_courant: number; hausse_relative: number };
}
export interface DriftSummary {
  drift_threshold: number; n_features_monitored: number;
  scenarios: { stable: DriftScenario; derive: DriftScenario };
}
