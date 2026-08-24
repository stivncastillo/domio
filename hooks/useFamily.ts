/**
 * Datos de la familia en si (nombre, codigo de invitacion) y la lista
 * de integrantes con su perfil. Distinto de useFamilyMember.ts, que
 * solo resuelve "¿el usuario actual ya pertenece a una familia?" para
 * decidir el ruteo de onboarding — este archivo es para la pantalla
 * de la tab Familia, una vez que ya estas adentro.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { FamilyRole } from "@/types/domain";

interface FamilyInfo {
  id: string;
  name: string;
  inviteCode: string;
}

export function useFamily(familyId: string | undefined) {
  return useQuery({
    queryKey: ["family", familyId],
    queryFn: async (): Promise<FamilyInfo | null> => {
      const { data, error } = await supabase
        .from("families")
        .select("id, name, invite_code")
        .eq("id", familyId as string)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return { id: data.id, name: data.name, inviteCode: data.invite_code };
    },
    enabled: !!familyId,
  });
}

export interface FamilyMemberWithProfile {
  id: string;
  profileId: string;
  displayName: string;
  role: FamilyRole;
  level: number;
  xp: number;
  streakDays: number;
}

export function useFamilyMembers(familyId: string | undefined) {
  return useQuery({
    queryKey: ["family-members", familyId],
    queryFn: async (): Promise<FamilyMemberWithProfile[]> => {
      // `profiles(display_name)` es un embed de PostgREST: sigue la
      // foreign key family_members.profile_id -> profiles.id
      // automaticamente, sin necesidad de un join manual.
      const { data, error } = await supabase
        .from("family_members")
        .select("id, profile_id, role, level, xp, streak_days, profiles(display_name)")
        .eq("family_id", familyId as string)
        .order("joined_at", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((m: any) => ({
        id: m.id,
        profileId: m.profile_id,
        displayName: m.profiles?.display_name ?? "—",
        role: m.role,
        level: m.level,
        xp: m.xp,
        streakDays: m.streak_days,
      }));
    },
    enabled: !!familyId,
  });
}
