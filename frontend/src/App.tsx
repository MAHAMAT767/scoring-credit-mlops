// src/App.tsx — routeur de l'application (3 pages).
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import ScoringClient from "./pages/ScoringClient";
import Assistant from "./pages/Assistant";
import Parametres from "./pages/Parametres";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scoring" element={<ScoringClient />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/parametres" element={<Parametres />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
