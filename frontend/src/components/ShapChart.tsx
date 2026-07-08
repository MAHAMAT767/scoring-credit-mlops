// src/components/ShapChart.tsx — contributions SHAP, thème clair (style mémoire).
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";
import type { Contribution } from "../types";

function cleanName(f: string): string {
  return f.replace(/^num__/, "").replace(/^cat__/, "");
}

export default function ShapChart({ contributions }: { contributions: Contribution[] }) {
  const data = contributions
    .map((c) => ({ name: cleanName(c.feature), value: c.contribution }))
    .reverse();

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 96 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" stroke="var(--text-muted)" fontSize={11} />
        <YAxis type="category" dataKey="name" stroke="var(--text-sub)" fontSize={11} width={96} />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.10)" }}
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 12 }}
          formatter={(value) => [Number(value).toFixed(3), "contribution"]}
        />
        <ReferenceLine x={0} stroke="var(--text-muted)" />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value > 0 ? "rgba(220,38,38,1)" : "rgba(16,185,129,1)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
