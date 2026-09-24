import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Minúsculo e sem acento: "Piúma" → "piuma", "PREGÃO" → "pregao". */
export function semAcento(texto: string | null | undefined): string {
  return (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Busca que ignora acento e maiúscula nos dois sentidos: "piuma" acha "PIÚMA" e vice-versa. */
export function contemTexto(texto: string | null | undefined, termo: string | null | undefined): boolean {
  return semAcento(texto).includes(semAcento(termo).trim());
}
