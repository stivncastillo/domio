/**
 * Zustand = estado local/efimero de UI, en memoria, sin pasar por el
 * servidor. Lo usamos para cosas como "que animacion esta mostrando
 * Domi ahora mismo" — no es un dato que viva en Supabase, es puramente
 * de la sesion actual de la app en el dispositivo.
 *
 * Regla simple para decidir Zustand vs TanStack Query:
 * - ¿El dato vive en la base de datos y otros dispositivos lo necesitan
 *   ver? -> Query (useMissions, useDomioProgress, etc).
 * - ¿Es solo un estado visual/temporal de esta pantalla o sesion?
 *   -> Zustand (o incluso useState si es de un solo componente).
 */
import { create } from "zustand";

export type DomiMood = "happy" | "calm" | "alert" | "tired";

interface DomiUiState {
  mood: DomiMood;
  isCelebrating: boolean;
  setMood: (mood: DomiMood) => void;
  celebrate: () => void;
  stopCelebrating: () => void;
}

export const useDomiStore = create<DomiUiState>((set) => ({
  mood: "calm",
  isCelebrating: false,
  setMood: (mood) => set({ mood }),
  celebrate: () => set({ isCelebrating: true }),
  stopCelebrating: () => set({ isCelebrating: false }),
}));
