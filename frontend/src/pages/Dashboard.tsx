import { useQuery } from "@tanstack/react-query";
import {
  Users, ShieldAlert, ShieldCheck, TrendingDown, SlidersHorizontal, Info,
  AlertTriangle, XCircle, ServerCrash,
} from "lucide-react";
import { getMetrics, getStats } from "../api/client";
import type { Metrics, DatasetStats } from "../types";
import { Card, Kpi, SectionLabel, InsightCard, Reveal, EmptyState } from "../components/ui";

export default function Dashboard() {
  const { data: stats } = useQuery<DatasetStats>({ queryKey: ["stats"], queryFn: getStats, retry: false });
  const { data: m, isError } = useQuery<Metrics>({ queryKey: ["metrics"], queryFn: getMetrics, retry: false });

  if (isError) {
    return (
      <EmptyState
        icon={ServerCrash}
        tone="danger"
        title="Informations indisponibles pour le moment"
        text="Vérifiez que le serveur API est bien lancé, puis rechargez la page."
      />
    );
  }

  const t = m?.test_metrics;

  const gainPct = m && t && m.baseline_cost_per_client > 0
    ? ((m.baseline_cost_per_client - t.cost_per_client) / m.baseline_cost_per_client) * 100
    : null;
  const defautsRepere = t ? Math.round(t.recall * 100) : 0;
  const alertesFiables = t ? Math.round(t.precision * 100) : 0;

  return (
    <>
      <Reveal>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{
            background: "linear-gradient(90deg, var(--text) 0%, var(--primary-light) 50%, var(--text) 100%)",
            backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text",
            color: "transparent", WebkitTextFillColor: "transparent",
            animation: "shimmer 5s linear infinite", display: "inline-block",
          }}>
            Tableau de bord
          </h1>
          <p style={{ color: "var(--text-sub)", fontSize: "0.9rem", marginTop: 4 }}>
            Vue d'ensemble simple et directe : ce que fait le système et à quel point il est fiable.
          </p>
        </div>
      </Reveal>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <Kpi delay={0} icon={Users} label="Clients" value={stats?.n_clients ?? 0} color="rgba(37,99,235,1)" />
        <Kpi delay={0.05} icon={ShieldAlert} label="Taux de risque" value={(stats?.default_rate ?? 0) * 100}
             decimals={1} suffix="%" gaugeMax={100} color="rgba(245,158,11,1)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
        <Kpi delay={0.15} icon={TrendingDown} label="Coût / client" value={t?.cost_per_client ?? 0}
             decimals={3} color="rgba(16,185,129,1)" highlight
             alert={gainPct !== null && gainPct <= 0 ? "Pas d'économie mesurée pour l'instant" : undefined} />
        <Kpi delay={0.2} icon={ShieldAlert} label="Défauts repérés" value={defautsRepere}
             suffix="%" gaugeMax={100} color="rgba(37,99,235,1)" />
        <Kpi delay={0.25} icon={ShieldCheck} label="Alertes fiables" value={alertesFiables}
             suffix="%" gaugeMax={100} color="rgba(245,158,11,1)" />
        <Kpi delay={0.3} icon={SlidersHorizontal} label="Seuil d'alerte" value={(m?.threshold ?? 0) * 100}
             decimals={1} suffix="%" gaugeMax={100} color="rgba(37,99,235,1)" />
      </div>

      <Card beam beamColor="rgba(37,99,235,1)" delay={0.3}>
        <SectionLabel>Sur les clients testés</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 6 }}>
          <Kpi delay={0.35} icon={ShieldCheck} label="Bons payeurs" value={t?.tn ?? 0} color="rgba(16,185,129,1)" />
          <Kpi delay={0.4}  icon={AlertTriangle} label="Fausses alertes" value={t?.fp ?? 0} color="rgba(245,158,11,1)" />
          <Kpi delay={0.45} icon={XCircle} label="Défauts manqués" value={t?.fn ?? 0} color="rgba(220,38,38,1)" />
          <Kpi delay={0.5}  icon={ShieldAlert} label="Défauts détectés" value={t?.tp ?? 0} color="rgba(16,185,129,1)" />
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 16, lineHeight: 1.5 }}>
          Le système préfère se tromper en déclenchant une fausse alerte plutôt que de laisser passer un vrai mauvais payeur — rater un défaut coûte bien plus cher.
        </p>
      </Card>

      {m && t && (
        <Card beam beamColor="rgba(16,185,129,1)" delay={0.55} style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <Info size={13} style={{ color: "var(--text-muted)" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Ce qu'il faut retenir
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {gainPct !== null && (
              <InsightCard
                delay={0}
                icon={TrendingDown}
                tone={gainPct > 0 ? "success" : "danger"}
                title={gainPct > 0
                  ? `${gainPct.toFixed(0)} % d'erreurs coûteuses en moins`
                  : `${Math.abs(gainPct).toFixed(0)} % d'erreurs coûteuses en plus`}
                text={gainPct > 0
                  ? "Par rapport à une règle simple, ce système évite une bonne partie des erreurs qui coûtent cher."
                  : "Ce système ne fait pas mieux qu'une règle simple pour l'instant sur ces données."}
              />
            )}
            <InsightCard
              delay={0.08}
              icon={ShieldAlert}
              tone="neutral"
              title={`${defautsRepere} mauvais payeurs sur 100 sont repérés`}
              text="Le système est réglé pour attraper un maximum de clients à risque, quitte à se tromper un peu plus souvent dans l'autre sens."
            />
            <InsightCard
              delay={0.16}
              icon={ShieldCheck}
              tone="neutral"
              title={`${alertesFiables} alertes sur 100 sont justifiées`}
              text="Quand le système signale un client comme risqué, c'est le bon appel la plupart du temps."
            />
            <InsightCard
              delay={0.24}
              icon={SlidersHorizontal}
              tone="neutral"
              title={`Alerte déclenchée dès ${(m.threshold * 100).toFixed(0)} % de risque estimé`}
              text="Ce réglage a été choisi pour éviter au maximum de laisser passer un mauvais payeur."
            />
          </div>
        </Card>
      )}
    </>
  );
}