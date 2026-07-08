// src/components/ResultPanel.tsx — résultat, style mémoire (thème clair).
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Gauge, SlidersHorizontal, ServerCrash } from "lucide-react";
import RiskGauge from "./RiskGauge";
import ShapChart from "./ShapChart";
import { Card, Kpi, Badge } from "./ui";
import type { ScoreResponse, ExplainResponse } from "../types";

interface Props {
  result: ScoreResponse | null;
  explanation: ExplainResponse | null;
  error: string | null;
  actualDefault?: number | null;
}

const riskColor = (r: string) => r === "faible" ? "rgba(16,185,129,1)" : r === "modéré" ? "rgba(245,158,11,1)" : "rgba(220,38,38,1)";

export default function ResultPanel({ result, explanation, error, actualDefault }: Props) {
  if (error) {
    return (
      <Card style={{ textAlign: "center", padding: "50px 24px" }}>
        <ServerCrash size={30} style={{ color: "var(--danger)", marginBottom: 12 }} />
        <p style={{ fontWeight: 700, color: "var(--danger)" }}>Impossible de contacter l'API</p>
        <p style={{ fontSize: 13, color: "var(--text-sub)", marginTop: 6 }}>{error}</p>
      </Card>
    );
  }
  if (!result) {
    return (
      <Card style={{ textAlign: "center", padding: "64px 24px" }}>
        <Gauge size={28} style={{ color: "var(--text-muted)", marginBottom: 10 }} />
        <p style={{ color: "var(--text-sub)" }}>Renseignez un profil puis lancez l'évaluation.</p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Décision fondée sur le score métier (coût FN 5× FP).</p>
      </Card>
    );
  }

  const refused = result.decision.startsWith("Crédit refusé");
  const dcol = refused ? "rgba(220,38,38,1)" : "rgba(16,185,129,1)";

  return (
    <Card style={{ padding: 22 }}>
      <RiskGauge probability={result.probability_default} threshold={result.threshold} />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: 12, marginTop: 4, marginBottom: 16, borderRadius: "var(--radius-md)",
          background: `${dcol}12`, border: `1px solid ${dcol}40`, color: dcol, fontWeight: 700, fontSize: "1.05rem" }}>
        {refused ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />} {result.decision}
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <Kpi icon={Gauge} label="Niveau de risque" raw={result.risk_level} color={riskColor(result.risk_level)} />
        <Kpi icon={SlidersHorizontal} label="Seuil de décision" value={result.threshold * 100} decimals={1} suffix="%" />
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <Badge label={`Risque ${result.risk_level}`} color={riskColor(result.risk_level)} />
      </div>

      {actualDefault !== null && actualDefault !== undefined && (
        <div style={{ borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13,
          background: actualDefault === 1 ? "rgba(220,38,38,0.06)" : "rgba(16,185,129,0.06)",
          border: `1px solid ${actualDefault === 1 ? "rgba(220,38,38,0.30)" : "rgba(16,185,129,0.30)"}`,
          color: actualDefault === 1 ? "var(--danger)" : "var(--success)" }}>
          <span style={{ color: "var(--text-muted)" }}>Réalité (dataset) : </span>
          <strong>{actualDefault === 1 ? "ce client a fait défaut" : "ce client a remboursé"}</strong>
          {" · "}
          <span style={{ color: "var(--text-muted)" }}>
            {(actualDefault === 1) === refused ? "prédiction correcte ✓" : "prédiction erronée ✗"}
          </span>
        </div>
      )}

      {explanation && (
        <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <h3 style={{ marginBottom: 2 }}>Facteurs de la décision</h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
            Rouge = pousse vers le défaut · Vert = vers le remboursement
          </p>
          <ShapChart contributions={explanation.top_contributions} />
        </div>
      )}
    </Card>
  );
}
