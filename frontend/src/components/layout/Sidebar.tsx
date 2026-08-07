import { NavLink } from "react-router-dom";
import { LayoutDashboard, Search, SlidersHorizontal, CreditCard, Bot, Sun, Moon } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/scoring", label: "Scoring client", icon: Search },
  { to: "/assistant", label: "Assistant", icon: Bot },
  { to: "/parametres", label: "Paramètres", icon: SlidersHorizontal },
];

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <aside style={{
      width: "var(--sidebar-w)", background: "var(--card)", borderRight: "1px solid var(--border)",
      height: "100vh", position: "sticky", top: 0, padding: "18px 12px",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 18px" }}>
        <div style={{ background: "var(--primary)", color: "#fff", padding: 7, borderRadius: 9, display: "flex" }}>
          <CreditCard size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", letterSpacing: "-0.02em", color: "var(--text)" }}>CreditScore</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>MLOps</div>
        </div>
      </div>

      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to}
          style={({ isActive }) => ({
            display: "flex", alignItems: "center", gap: 11, padding: "10px 12px",
            borderRadius: "var(--radius-sm)", fontSize: "0.85rem", fontWeight: 500,
            textDecoration: "none",
            color: isActive ? "var(--primary-light)" : "var(--text-sub)",
            background: isActive ? "var(--primary-bg)" : "transparent",
          })}>
          <Icon size={17} /> {label}
        </NavLink>
      ))}

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            padding: "9px 12px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--bg-subtle)",
            color: "var(--text-sub)", fontSize: "0.8125rem", fontWeight: 500,
          }}>
          {isDark ? <Sun size={16} style={{ color: "var(--warning)" }} /> : <Moon size={16} style={{ color: "var(--primary-light)" }} />}
          {isDark ? "Thème clair" : "Thème sombre"}
        </button>

        <div style={{ padding: "2px 8px 0", fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Dataset UCI<br />Default of Credit Card Clients by Mahamat Haroun Ibrahim
        </div>
      </div>
    </aside>
  );
}