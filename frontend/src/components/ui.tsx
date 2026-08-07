import { useState, type ReactNode, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";

export const COLORS = {
  danger: "rgba(220,38,38,1)",
  warning: "rgba(245,158,11,1)",
  success: "rgba(16,185,129,1)",
  primary: "rgba(37,99,235,1)",
};

function cssColor(c: string): string {
  if (c.startsWith("rgba") || c.startsWith("#")) return c;
  return "rgba(37,99,235,1)";
}

export function Reveal({ children, style, delay = 0 }:
  { children: ReactNode; style?: CSSProperties; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={style}>
      {children}
    </motion.div>
  );
}

export function Card({ children, style, delay = 0, beam = false, beamColor = "rgba(37,99,235,1)" }:
  { children: ReactNode; style?: CSSProperties; delay?: number; beam?: boolean; beamColor?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      style={{
        position: "relative", overflow: "hidden",
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)",
        padding: 20, ...style,
      }}>
      {beam && (
        <motion.div
          aria-hidden
          style={{
            position: "absolute", top: 0, left: "-30%", width: "30%", height: 2,
            background: `linear-gradient(90deg, transparent, ${beamColor}, transparent)`,
            filter: "blur(1px)", pointerEvents: "none",
          }}
          animate={{ left: ["-30%", "130%"] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "linear", delay: delay + 0.3 }}
        />
      )}
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{
      fontSize: 10.5, fontWeight: 700, color: "var(--text-muted)",
      textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10,
    }}>{children}</div>
  );
}

export function Kpi({
  icon: Icon, label, value, decimals = 0, suffix = "", raw, color = "var(--primary-light)",
  size = "md", delay = 0, gaugeMax, highlight = false, alert,
}: {
  icon?: LucideIcon; label: string; value?: number; decimals?: number; suffix?: string;
  raw?: string; color?: string; size?: "md" | "lg"; delay?: number; gaugeMax?: number;
  highlight?: boolean; alert?: string;
}) {
  const [hov, setHov] = useState(false);
  const c = cssColor(color);
  const pct = gaugeMax ? Math.min(Math.max((value ?? 0) / gaugeMax, 0), 1) : null;
  const isLg = size === "lg";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      whileHover={{ y: -3 }}
      style={{
        background: hov ? `${c}0e` : "var(--card)",
        border: `1px solid ${highlight ? `${c}66` : hov ? `${c}40` : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        padding: isLg ? "20px 18px" : "12px 14px",
        overflow: "hidden",
        transition: "background .2s, border-color .2s",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: isLg ? 10 : 4 }}>
        {Icon && <Icon size={isLg ? 15 : 13} style={{ color }} />}
        <span style={{ fontSize: isLg ? 10.5 : 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.09em" }}>{label}</span>
      </div>
      <div style={{ fontSize: isLg ? 34 : 20, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: hov ? color : "var(--text)", transition: "color .2s" }}>
        {raw !== undefined ? raw : <AnimatedNumber value={value ?? 0} decimals={decimals} suffix={suffix} />}
      </div>
      {pct !== null && (
        <div style={{ marginTop: isLg ? 14 : 8, height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }}
            transition={{ duration: 0.8, delay: delay + 0.1, ease: "easeOut" }}
            style={{ height: "100%", background: color, borderRadius: 3 }}
          />
        </div>
      )}
      {alert && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: "rgba(220,38,38,1)", lineHeight: 1.4 }}>
          {alert}
        </div>
      )}
    </motion.div>
  );
}

export function InsightCard({ icon: Icon, tone = "neutral", title, text, delay = 0 }:
  { icon?: LucideIcon; tone?: "success" | "danger" | "neutral"; title: string; text: string; delay?: number }) {
  const toneColor = tone === "success" ? COLORS.success : tone === "danger" ? COLORS.danger : COLORS.primary;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      style={{
        background: `${toneColor}0a`, border: `1px solid ${toneColor}30`,
        borderRadius: "var(--radius-md)", padding: "12px 14px",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {Icon && <Icon size={13} style={{ color: toneColor }} />}
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{title}</span>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>{text}</p>
    </motion.div>
  );
}

export function EmptyState({ icon: Icon, tone = "neutral", title, text }:
  { icon?: LucideIcon; tone?: "neutral" | "danger" | "warning"; title: string; text?: string }) {
  const c = tone === "danger" ? COLORS.danger : tone === "warning" ? COLORS.warning : "var(--text-muted)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        textAlign: "center", padding: "60px 24px", gap: 10,
        border: "1px dashed var(--border)", borderRadius: "var(--radius-lg)",
      }}>
      {Icon && <Icon size={32} style={{ color: c }} />}
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>{title}</h3>
      {text && <p style={{ fontSize: 12.5, color: "var(--text-muted)", maxWidth: 360, margin: 0 }}>{text}</p>}
    </motion.div>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  const c = cssColor(color);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 11.5, fontWeight: 600, color: c,
      background: `${c}14`, border: `1px solid ${c}40`,
      padding: "4px 12px", borderRadius: 20,
    }}>{label}</span>
  );
}