// src/components/RiskGauge.tsx — jauge semi-circulaire, thème clair (style mémoire).
import AnimatedNumber from "./AnimatedNumber";

function riskColor(p: number): string {
  if (p < 0.2) return "rgba(16,185,129,1)";
  if (p < 0.5) return "rgba(245,158,11,1)";
  return "rgba(220,38,38,1)";
}

export default function RiskGauge({ probability, threshold }:
  { probability: number; threshold: number }) {
  const pct = Math.max(0, Math.min(1, probability));
  const color = riskColor(pct);
  const cx = 130, cy = 130, r = 100;
  const start = Math.PI;
  const angle = start - pct * Math.PI;
  const point = (a: number): [number, number] => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const [x1, y1] = point(start);
  const [x2, y2] = point(angle);
  const largeArc = pct > 0.5 ? 1 : 0;
  const tAngle = start - threshold * Math.PI;
  const [tx, ty] = point(tAngle);
  const [tx2, ty2] = [cx + (r - 14) * Math.cos(tAngle), cy - (r - 14) * Math.sin(tAngle)];

  return (
    <svg viewBox="0 0 260 152" style={{ width: "100%", maxWidth: 300, margin: "0 auto", display: "block" }} role="img"
         aria-label={`Probabilite de defaut ${(pct * 100).toFixed(1)}%`}>
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`}
            fill="none" stroke="var(--border)" strokeWidth="16" strokeLinecap="round" />
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
            style={{ transition: "all 0.7s cubic-bezier(0.34,1.1,0.64,1)" }} />
      <line x1={tx2} y1={ty2} x2={tx} y2={ty} stroke="var(--text-muted)" strokeWidth="2" />
      <text x={cx} y={cy - 16} textAnchor="middle" fill={color}
            style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>
        <AnimatedNumber value={pct * 100} decimals={1} suffix="%" />
      </text>
      <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--text-muted)"
            style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
        probabilite de defaut
      </text>
    </svg>
  );
}
