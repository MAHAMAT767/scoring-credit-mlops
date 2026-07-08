// src/lib/utils.ts — utilitaire de fusion de classes Tailwind (convention shadcn/ui).
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
