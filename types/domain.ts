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
  coinReward: number; // solo se entrega en misiones "single", ver hooks/useMissions.ts
  assignedTo: string[]; // ids de FamilyMember (hoy: a lo sumo uno, ver hooks/useMissions.ts)
  assigneeName: string | null; // display_name del asignado, para mostrar en la UI sin otro fetch
  status: MissionStatus;
  dueAt: string | null; // ISO date
}

export interface Reward {
  id: string;
  familyId: string;
  title: string;
  costCoins: number;
  // Nivel que el Domio (no el integrante) tiene que haber alcanzado
  // para que esta recompensa se pueda reclamar, ademas de las coins.
  minDomioLevel: number;
  isFamilyReward: boolean;
}

export interface DomioProgress {
  familyId: string;
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  familyStreakDays: number;
  mood: "positive" | "neutral" | "alert" | "critical";
}
