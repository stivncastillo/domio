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

import type { MissionPenaltyEvent } from "@/types/domain";

export type DomiMood = "happy" | "calm" | "alert" | "tired";

interface DomiUiState {
  mood: DomiMood;
  isCelebrating: boolean;
  // Card de "misión no cumplida" (0015_mission_deadlines_and_penalties.sql):
  // lo dispara hooks/useRealtimeSync.ts al llegar un INSERT en
  // mission_penalties, lo lee components/domi/MissionPenaltyCard.tsx.
  // null = no hay card para mostrar. Se guarda el id del evento para
  // que el setTimeout que lo esconde (en useRealtimeSync) no borre por
  // error un card MAS NUEVO que llegó mientras tanto.
  missionPenalty: MissionPenaltyEvent | null;
  setMood: (mood: DomiMood) => void;
  celebrate: () => void;
  stopCelebrating: () => void;
  showMissionPenalty: (event: MissionPenaltyEvent) => void;
  dismissMissionPenalty: (id: string) => void;
}

export const useDomiStore = create<DomiUiState>((set, get) => ({
  mood: "calm",
  isCelebrating: false,
  missionPenalty: null,
  setMood: (mood) => set({ mood }),
  celebrate: () => set({ isCelebrating: true }),
  stopCelebrating: () => set({ isCelebrating: false }),
  showMissionPenalty: (event) => set({ missionPenalty: event }),
  dismissMissionPenalty: (id) => {
    if (get().missionPenalty?.id === id) set({ missionPenalty: null });
  },
}));
