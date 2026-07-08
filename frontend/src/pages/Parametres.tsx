// src/pages/Parametres.tsx — métriques, performances, MLflow, data drift.
import { useQuery } from "@tanstack/react-query";
import { Activity, GitBranch, Radar, Scale } from "lucide-react";
import { getMetrics, getDrift } from "../api/client";
import type { Metrics, DriftSummary } from "../types";
import { Card, SectionLabel, Badge } from "../components/ui";

export default function Parametres() {
  const { data: m } = useQuery<Metrics>({ queryKey: ["metrics"], queryFn: getMetrics, retry: false });
  const { data: d } = useQuery<DriftSummary>({ queryKey: ["drift"], queryFn: getDrift, retry: false });

  const t = m?.test_metrics;
  const pct = (x?: number) => (x === undefined ? "—" : `${(x * 100).toFixed(1)}%`);
  const num = (x?: number, dec = 3) => (x === undefined ? "—" : x.toFixed(dec));

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Paramètres & performances</h1>
        <p style={{ color: "var(--text-sub)", fontSize: "0.9rem", marginTop: 4 }}>
          Métriques du modèle, suivi MLflow et surveillance de la dérive des données.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        {/* Performances du modèle */}
        <Card>
          <SectionLabel><Row icon={Activity}>Performances du modèle (jeu de test)</Row></SectionLabel>
          <table style={{ marginTop: 4 }}>
            <tbody>
              <MetricRow label="ROC-AUC" value={num(t?.roc_auc)} />
              <MetricRow label="Recall (défauts détectés)" value={pct(t?.recall)} />
              <MetricRow label="Précision" value={pct(t?.precision)} />
              <MetricRow label="F1-score" value={num(t?.f1)} />
              <MetricRow label="Coût métier / client" value={num(t?.cost_per_client)} strong />
              <MetricRow label="Coût baseline / client" value={num(m?.baseline_cost_per_client)} />
              <MetricRow label="Seuil de décision" value={pct(m?.threshold)} />
            </tbody>
          </table>
        </Card>

        {/* Gestion du déséquilibre */}
        <Card>
          <SectionLabel><Row icon={Scale}>Gestion du déséquilibre</Row></SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 6 }}>
            <CompareCell label="Pondération des classes" value={num(m?.imbalance_comparison.class_weight_cost)} best />
            <CompareCell label="SMOTE" value={num(m?.imbalance_comparison.smote_cost)} />
          </div>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
            La pondération des classes a été retenue : elle obtient un coût métier inférieur à SMOTE sur ce dataset.
          </p>
          <div style={{ marginTop: 14 }}>
            <SectionLabel>Coût du score métier</SectionLabel>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge label={`Faux négatif = ${m?.cost_fn ?? 5}×`} color="rgba(220,38,38,1)" />
              <Badge label={`Faux positif = ${m?.cost_fp ?? 1}×`} color="rgba(245,158,11,1)" />
            </div>
          </div>
        </Card>

        {/* MLflow */}
        <Card>
          <SectionLabel><Row icon={GitBranch}>Suivi des expériences — MLflow</Row></SectionLabel>
          <table style={{ marginTop: 4 }}>
            <tbody>
              <MetricRow label="Expérience" value={m?.experiment_name ?? "—"} />
              <MetricRow label="Backend de suivi" value="SQLite (mlflow.db)" />
              <MetricRow label="Run ID" value={m ? m.mlflow_run_id.slice(0, 12) + "…" : "—"} />
              <MetricRow label="Entraîné le" value={m ? new Date(m.trained_at).toLocaleString("fr-FR") : "—"} />
            </tbody>
          </table>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-subtle)", borderRadius: "var(--radius-sm)",
            fontSize: 11.5, color: "var(--text-sub)", fontFamily: "monospace" }}>
            mlflow ui --backend-store-uri sqlite:///mlflow.db --port 5000
          </div>
        </Card>

        {/* Data drift */}
        <Card>
          <SectionLabel><Row icon={Radar}>Surveillance de la dérive (data drift)</Row></SectionLabel>
          {d ? (
            <>
              <p style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 12 }}>
                {d.n_features_monitored} variables surveillées · seuil d'alerte {(d.drift_threshold * 100).toFixed(0)} %
              </p>
              <DriftRow title="Scénario stable" s={d.scenarios.stable} ok />
              <DriftRow title="Scénario dégradé (récession)" s={d.scenarios.derive} />
            </>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Rapport indisponible. Lancez <code>python -m src.drift</code>.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ icon: Icon, children }: { icon: typeof Activity; children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon size={13} /> {children}</span>;
}

function MetricRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td style={{ color: "var(--text-sub)", fontSize: "0.8rem" }}>{label}</td>
      <td style={{ textAlign: "right", fontWeight: strong ? 800 : 600, color: strong ? "var(--primary-light)" : "var(--text)", fontSize: "0.85rem" }}>{value}</td>
    </tr>
  );
}

function CompareCell({ label, value, best }: { label: string; value: string; best?: boolean }) {
  const color = best ? "rgba(16,185,129,1)" : "var(--text-muted)";
  return (
    <div style={{ border: `1px solid ${best ? "rgba(16,185,129,0.35)" : "var(--border)"}`, background: best ? "rgba(16,185,129,0.06)" : "var(--bg-subtle)",
      borderRadius: "var(--radius-md)", padding: "12px", textAlign: "center" }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{label}</div>
    </div>
  );
}

function DriftRow({ title, s, ok }: { title: string; s: import("../types").DriftScenario; ok?: boolean }) {
  const color = ok ? "rgba(16,185,129,1)" : "rgba(220,38,38,1)";
  return (
    <div style={{ border: `1px solid ${color}33`, background: `${color}08`, borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <strong style={{ color, fontSize: "0.85rem" }}>{title}</strong>
        <span style={{ fontSize: 12, color: "var(--text-sub)" }}>{s.n_drifted} variables en dérive ({(s.drift_share * 100).toFixed(0)} %)</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-sub)" }}>
        Proba défaut : {s.prediction_drift.proba_defaut_reference.toFixed(3)} → {s.prediction_drift.proba_defaut_courant.toFixed(3)}
        <span style={{ color, fontWeight: 700 }}> ({s.prediction_drift.hausse_relative > 0 ? "+" : ""}{s.prediction_drift.hausse_relative.toFixed(0)} %)</span>
      </div>
    </div>
  );
}
