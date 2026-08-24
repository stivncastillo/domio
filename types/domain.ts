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
  level: number;
  xp: number;
  streakDays: number;
}

export interface Mission {
  id: string;
  familyId: string;
  title: string;
  type: MissionType;
  isMandatory: boolean;
  xpReward: number;
  assignedTo: string[]; // ids de FamilyMember
  status: MissionStatus;
  dueAt: string | null; // ISO date
}

export interface Reward {
  id: string;
  familyId: string;
  title: string;
  costPoints: number;
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
