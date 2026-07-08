// src/hooks/useScoring.ts — Hook react-query pour lancer prédiction + explication.

import { useMutation } from "@tanstack/react-query";
import { predict, explain } from "../api/client";
import type { ClientData, ScoreResponse, ExplainResponse } from "../types";

export interface ScoringResult {
  score: ScoreResponse;
  explanation: ExplainResponse;
}

export function useScoring() {
  return useMutation<ScoringResult, Error, ClientData>({
    mutationFn: async (data) => {
      const [score, explanation] = await Promise.all([predict(data), explain(data)]);
      return { score, explanation };
    },
  });
}
