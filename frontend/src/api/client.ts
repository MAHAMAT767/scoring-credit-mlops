// src/api/client.ts — Appels à l'API de scoring crédit.
// Même patron que le mémoire (instance axios + fonctions), adapté au TD :
// routes SANS préfixe /api, contrat ScoreResponse/ExplainResponse.

import axios from "axios";
import type { ClientData, ScoreResponse, ExplainResponse, ClientLookup } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const API = axios.create({ baseURL: API_URL, timeout: 15000 });

export const predict = (data: ClientData) =>
  API.post<ScoreResponse>("/predict", data).then((r) => r.data);

export const explain = (data: ClientData) =>
  API.post<ExplainResponse>("/explain", data).then((r) => r.data);

export const getClient = (id: number) =>
  API.get<ClientLookup>(`/client/${id}`).then((r) => r.data);

export const chatMessage = (payload: { messages: { role: string; content: string }[]; client_id?: number }) =>
  API.post("/chat", payload).then((r) => r.data);

export const retrain = () => API.post("/retrain").then((r) => r.data);
export const getRetrainStatus = () => API.get("/retrain-status").then((r) => r.data);

export const getMetrics = () => API.get("/metrics").then((r) => r.data);
export const getDrift = () => API.get("/drift").then((r) => r.data);
export const getStats = () => API.get("/dataset-stats").then((r) => r.data);

export const health = () => API.get("/health").then((r) => r.data);