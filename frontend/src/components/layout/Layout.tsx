// src/components/layout/Layout.tsx — coquille de l'application (sidebar + topbar).
import { Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import Sidebar from "./Sidebar";
import { health } from "../../api/client";

const TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/scoring": "Scoring client",
  "/assistant": "Assistant crédit",
  "/parametres": "Paramètres & performances",
};

export default function Layout() {
  const { pathname } = useLocation();
  const { data: h } = useQuery({ queryKey: ["health"], queryFn: health, retry: false });
  const online = !!h;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          height: "var(--topbar-h)", borderBottom: "1px solid var(--border)", background: "var(--card)",
          display: "flex", alignItems: "center", padding: "0 24px", position: "sticky", top: 0, zIndex: 10,
        }}>
          <h2 style={{ fontSize: "1rem" }}>{TITLES[pathname] ?? "Scoring crédit"}</h2>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            color: online ? "var(--success)" : "var(--danger)" }}>
            {online ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            {online ? "API connectée" : "API hors ligne"}
             <div style={{ padding: "2px 8px 0", fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Mahamat Haroun Ibrahim
        </div>
          </div>
        </div>
        <main style={{ padding: 24, maxWidth: 1240, margin: "0 auto" }}>
          
          <Outlet />
        </main>
      </div>
    </div>
  );
}
