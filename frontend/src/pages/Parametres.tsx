import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, GitBranch, Radar, Scale, RefreshCw, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getMetrics, getDrift, retrain, getRetrainStatus } from "../api/client";
import type { Metrics, DriftSummary } from "../types";
import { Card, SectionLabel, Badge } from "../components/ui";

export default function Parametres() {
  const { data: m } = useQuery<Metrics>({ queryKey: ["metrics"], queryFn: getMetrics, retry: false });
  const { data: d } = useQuery<DriftSummary>({ queryKey: ["drift"], queryFn: getDrift, retry: false });

  const t = m?.test_metrics;
  const pct = (x?: number) => (x === undefined ? "—" : `${(x * 100).toFixed(1)}%`);
  const num = (x?: number, dec = 3) => (x === undefined ? "—" : x.toFixed(dec));

  const driftDetected = !!d && d.scenarios.derive.drift_share >= d.drift_threshold;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1>Paramètres & performances</h1>
        <p style={{ color: "var(--text-sub)", fontSize: "0.9rem", marginTop: 4 }}>
          Métriques du modèle, suivi MLflow et surveillance de la dérive des données.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
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

        <Card>
          <SectionLabel><Row icon={Radar}>Surveillance de la dérive (data drift)</Row></SectionLabel>
          {d ? (
            <>
              <p style={{ fontSize: 12, color: "var(--text-sub)", marginBottom: 12 }}>
                {d.n_features_monitored} variables surveillées · seuil d'alerte {(d.drift_threshold * 100).toFixed(0)} %
              </p>
              <DriftRow title="Scénario stable" s={d.scenarios.stable} ok />
              <DriftRow title="Scénario dégradé (récession)" s={d.scenarios.derive} />
              <RetrainPanel driftDetected={driftDetected} />
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

function RetrainPanel({ driftDetected }: { driftDetected: boolean }) {
  const [state, setState] = useState<"idle" | "training" | "done" | "error" | "simulated" | "resolved">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getRetrainStatus()
      .then((s) => { if (s.state === "done") setState("resolved"); })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const launch = async () => {
    setState("training");
    setStatusMsg("Envoi de la demande de réentraînement…");
    try {
      const res = await retrain();
      if (res.mode === "simulated") {
        setStatusMsg(res.message);
        setState("simulated");
        return;
      }
      setStatusMsg("Réentraînement en cours (peut prendre quelques minutes)…");
      pollRef.current = setInterval(async () => {
        try {
          const s = await getRetrainStatus();
          if (s.message) setStatusMsg(s.message);
          if (s.state === "done") {
            if (pollRef.current) clearInterval(pollRef.current);
            setState("done");
          } else if (s.state === "error") {
            if (pollRef.current) clearInterval(pollRef.current);
            setState("error");
          }
        } catch { /* ignore */ }
      }, 3000);
    } catch (e: any) {
      setStatusMsg(e?.response?.data?.detail ?? "Impossible de joindre l'API.");
      setState("error");
    }
  };

  if (!driftDetected) return null;

  const showAlert = state === "idle" || state === "training" || state === "error";

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      {showAlert && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
          background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.30)",
          borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
          <AlertTriangle size={16} color="rgba(220,38,38,1)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
            <strong style={{ color: "rgba(220,38,38,1)" }}>Dérive significative détectée.</strong>{" "}
            Un réentraînement du modèle est recommandé.
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.button key="btn" onClick={launch}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
              padding: "11px", borderRadius: "var(--radius-md)", border: "none",
              background: "var(--primary)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            <RefreshCw size={15} /> Réentraîner le modèle
          </motion.button>
        )}

        {state === "training" && (
          <motion.div key="train" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ display: "flex" }}>
                <RefreshCw size={14} color="var(--primary-light)" />
              </motion.div>
              <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>{statusMsg}</span>
            </div>
            <div style={{ height: 7, background: "var(--border)", borderRadius: 6, overflow: "hidden" }}>
              <motion.div animate={{ x: ["-40%", "140%"] }} transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                style={{ height: "100%", width: "40%", borderRadius: 6, background: "var(--primary-light)" }} />
            </div>
          </motion.div>
        )}

        {state === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "flex", alignItems: "center", gap: 8,
              background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.30)",
              borderRadius: "var(--radius-md)", padding: "11px 12px" }}>
            <CheckCircle2 size={16} color="rgba(16,185,129,1)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
              <strong style={{ color: "rgba(16,185,129,1)" }}>Réentraînement terminé.</strong>{" "}
              {statusMsg || "Le nouveau modèle a été chargé."} Rechargez la page pour voir les métriques mises à jour.
            </span>
          </motion.div>
        )}

        {state === "resolved" && (
          <motion.div key="resolved" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "flex", alignItems: "center", gap: 8,
              background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.30)",
              borderRadius: "var(--radius-md)", padding: "11px 12px" }}>
            <CheckCircle2 size={16} color="rgba(16,185,129,1)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
              <strong style={{ color: "rgba(16,185,129,1)" }}>Modèle réentraîné — surveillance réinitialisée.</strong>{" "}
              L'alerte de dérive a été prise en charge.
            </span>
          </motion.div>
        )}

        {state === "simulated" && (
          <motion.div key="sim" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            style={{ display: "flex", alignItems: "center", gap: 8,
              background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.30)",
              borderRadius: "var(--radius-md)", padding: "11px 12px" }}>
            <Info size={16} color="var(--primary-light)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
              <strong style={{ color: "var(--primary-light)" }}>Déclenchement enregistré.</strong> {statusMsg}
            </span>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: "flex", alignItems: "center", gap: 8,
              background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.30)",
              borderRadius: "var(--radius-md)", padding: "11px 12px" }}>
            <AlertTriangle size={16} color="rgba(220,38,38,1)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--text-sub)" }}>
              <strong style={{ color: "rgba(220,38,38,1)" }}>Échec.</strong> {statusMsg}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5, fontStyle: "italic" }}>
        En production, ce déclencheur appellerait un pipeline d'entraînement dédié (ex. GitHub Actions / Airflow),
        et non l'API elle-même, pour des raisons de ressources.
      </p>
    </div>
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