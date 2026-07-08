// src/components/ClientForm.tsx — formulaire, style mémoire (thème clair).
import { UserCheck, AlertTriangle, Sparkles, Search } from "lucide-react";
import type { ClientData } from "../types";
import { Card, SectionLabel } from "./ui";

interface Props {
  data: ClientData;
  onChange: (data: ClientData) => void;
  onSubmit: () => void;
  onPreset: (kind: "risque" | "sain") => void;
  loading: boolean;
  clientId: string;
  onClientIdChange: (v: string) => void;
  onLoadClient: () => void;
  loadingClient: boolean;
}

type Field = { key: keyof ClientData; label: string };
const series = (prefix: string) =>
  [1, 2, 3, 4, 5, 6].map((i) => ({ key: `${prefix}${i}` as keyof ClientData, label: `M${i}` }));
const PAY = series("PAY_"), BILL = series("BILL_AMT"), PAYAMT = series("PAY_AMT");

const inputStyle: React.CSSProperties = { padding: "8px 10px", width: "100%" };
const fieldLabel: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "block" };
const gap6: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 };

export default function ClientForm({ data, onChange, onSubmit, onPreset, loading,
  clientId, onClientIdChange, onLoadClient, loadingClient }: Props) {
  const set = (key: keyof ClientData, value: number) => onChange({ ...data, [key]: value });

  const numInput = (f: Field) => (
    <div key={f.key}>
      <label style={fieldLabel}>{f.label}</label>
      <input type="number" style={inputStyle} value={data[f.key]}
             onChange={(e) => set(f.key, Number(e.target.value))} />
    </div>
  );

  const presetBtn = (kind: "sain" | "risque", Icon: typeof UserCheck, txt: string, color: string) => (
    <button type="button" onClick={() => onPreset(kind)}
      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "8px", borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)",
        border: "1px solid var(--border)", color: "var(--text-sub)", fontSize: 12.5, fontWeight: 500 }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
      <Icon size={14} /> {txt}
    </button>
  );

  return (
    <Card style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: "1.05rem" }}>Profil client</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {presetBtn("sain", UserCheck, "Sain", "rgba(16,185,129,1)")}
          {presetBtn("risque", AlertTriangle, "À risque", "rgba(220,38,38,1)")}
        </div>
      </div>

      {/* Recherche par ID */}
      <div style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 18 }}>
        <SectionLabel><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Search size={12} /> Charger un client réel par son ID (1 à 30000)</span></SectionLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" placeholder="Ex. 1" value={clientId} style={{ ...inputStyle, flex: 1 }}
                 onChange={(e) => onClientIdChange(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter") onLoadClient(); }} />
          <button type="button" onClick={onLoadClient} disabled={loadingClient}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px", borderRadius: "var(--radius-sm)",
              background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 600 }}>
            <Search size={14} /> {loadingClient ? "…" : "Charger"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <SectionLabel>Profil</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <div><label style={fieldLabel}>Limite de crédit</label>
              <input type="number" style={inputStyle} value={data.LIMIT_BAL} onChange={(e) => set("LIMIT_BAL", Number(e.target.value))} /></div>
            <div><label style={fieldLabel}>Âge</label>
              <input type="number" style={inputStyle} value={data.AGE} onChange={(e) => set("AGE", Number(e.target.value))} /></div>
            <div><label style={fieldLabel}>Sexe</label>
              <select style={inputStyle} value={data.SEX} onChange={(e) => set("SEX", Number(e.target.value))}>
                <option value={1}>Homme</option><option value={2}>Femme</option></select></div>
            <div><label style={fieldLabel}>Éducation</label>
              <select style={inputStyle} value={data.EDUCATION} onChange={(e) => set("EDUCATION", Number(e.target.value))}>
                <option value={1}>Master</option><option value={2}>Université</option><option value={3}>Lycée</option><option value={4}>Autres</option></select></div>
            <div><label style={fieldLabel}>Statut marital</label>
              <select style={inputStyle} value={data.MARRIAGE} onChange={(e) => set("MARRIAGE", Number(e.target.value))}>
                <option value={1}>Marié(e)</option><option value={2}>Célibataire</option><option value={3}>Autres</option></select></div>
          </div>
        </div>
        <div><SectionLabel>Historique de paiement (≥1 = mois de retard)</SectionLabel><div style={gap6}>{PAY.map(numInput)}</div></div>
        <div><SectionLabel>Montants facturés</SectionLabel><div style={gap6}>{BILL.map(numInput)}</div></div>
        <div><SectionLabel>Montants remboursés</SectionLabel><div style={gap6}>{PAYAMT.map(numInput)}</div></div>

        <button onClick={onSubmit} disabled={loading}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
            padding: 13, borderRadius: "var(--radius-md)", background: "var(--primary-light)", color: "#fff",
            fontSize: 14.5, fontWeight: 600 }}>
          <Sparkles size={16} /> {loading ? "Analyse en cours…" : "Évaluer le risque"}
        </button>
      </div>
    </Card>
  );
}
