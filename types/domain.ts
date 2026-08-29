/**
 * Tipos de dominio de Domio, basados en el Product & UX Brief.
 * Estos son los tipos que usan los componentes; `types/database.ts`
 * tiene el shape crudo tal como vive en Supabase (snake_case).
 */

export type MissionType = "single" | "recurring" | "habit" | "family";

export type MissionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "skipped"
  | "rescheduled";

export type FamilyRole = "admin" | "member";

export interface FamilyMember {
  id: string;
  familyId: string;
  displayName: string;
  role: FamilyRole;
  avatarUrl: string | null;
  // No hay level/xp individual: no hay competencia entre integrantes,
  // solo el Domio sube de nivel (ver DomioProgress). Lo individual es
  // la moneda gastable en recompensas.
  coins: number;
  streakDays: number;
}

export interface Mission {
  id: string;
  familyId: string;
  title: string;
  type: MissionType;
  isMandatory: boolean;
  xpReward: number;
  coinReward: number; // se entrega a quien completa la mision (single o family), ver hooks/useMissions.ts
  assignedTo: string[]; // ids de FamilyMember (hoy: a lo sumo uno, ver hooks/useMissions.ts)
  assigneeName: string | null; // display_name del asignado, para mostrar en la UI sin otro fetch
  status: MissionStatus;
  // Vencimiento (0015_mission_deadlines_and_penalties.sql): solo tiene
  // sentido cuando isMandatory es true — una mision obligatoria SIEMPRE
  // tiene dueAt + xpPenalty (el constraint de la tabla lo exige). Si no
  // se completa antes de dueAt, process_overdue_missions la marca
  // 'failed' y le resta xpPenalty al XP del Domio.
  dueAt: string | null; // ISO date
  xpPenalty: number;
}

// Evento de Realtime (tabla mission_penalties) que dispara el card de
// "no se cumplió a tiempo" — ver hooks/useRealtimeSync.ts y
// components/domi/MissionPenaltyCard.tsx.
export interface MissionPenaltyEvent {
  id: string;
  missionTitle: string;
  xpLost: number;
}

export type RewardRedemptionLimitType = "unlimited" | "once" | "cooldown";

export interface Reward {
  id: string;
  familyId: string;
  title: string;
  costCoins: number;
  // Nivel que el Domio (no el integrante) tiene que haber alcanzado
  // para que esta recompensa se pueda reclamar, ademas de las coins.
  minDomioLevel: number;
  isFamilyReward: boolean;
  // Limite de canjes (0014_reward_redemption_limits.sql). El alcance
  // depende de isFamilyReward: si es familiar, el limite es compartido
  // por toda la familia; si es individual, cada integrante tiene su
  // propio contador (ver redeem_reward / reward_lock_status_for_family).
  redemptionLimitType: RewardRedemptionLimitType;
  // Solo tiene valor cuando redemptionLimitType === "cooldown".
  cooldownDays: number | null;
}

// Devuelto por la RPC reward_lock_status_for_family — si la recompensa
// esta bloqueada ahora mismo por el limite de canjes, y desde cuando
// vuelve a estar disponible (null si no aplica: "once" bloqueada para
// siempre, o "unlimited" nunca bloqueada).
export interface RewardLockStatus {
  isLocked: boolean;
  availableAt: string | null; // ISO date
}

export interface DomioProgress {
  familyId: string;
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  familyStreakDays: number;
  mood: "positive" | "neutral" | "alert" | "critical";
}
