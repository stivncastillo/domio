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
  coins: number;
  streakDays: number;
}

// Ojo: no hay level/xp acá a propósito — no hay competencia entre
// integrantes, así que solo el Domio sube de nivel (useDomioProgress).
// Lo individual es la moneda (coins).
export function useFamilyMembers(familyId: string | undefined) {
  return useQuery({
    queryKey: ["family-members", familyId],
    queryFn: async (): Promise<FamilyMemberWithProfile[]> => {
      // `profiles(display_name)` es un embed de PostgREST: sigue la
      // foreign key family_members.profile_id -> profiles.id
      // automaticamente, sin necesidad de un join manual.
      const { data, error } = await supabase
        .from("family_members")
        .select("id, profile_id, role, coins, streak_days, profiles(display_name)")
        .eq("family_id", familyId as string)
        .order("joined_at", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((m: any) => ({
        id: m.id,
        profileId: m.profile_id,
        displayName: m.profiles?.display_name ?? "—",
        role: m.role,
        coins: m.coins,
        streakDays: m.streak_days,
      }));
    },
    enabled: !!familyId,
  });
}

export interface WeeklyContribution {
  familyMemberId: string;
  displayName: string;
  xpThisWeek: number;
}

/**
 * "EQUIPO DOMIO" en el Home (2026-08-30): cuánto XP aportó cada
 * integrante al Domio esta semana. A propósito NO se ordena por XP
 * (Stiven pidió explícitamente evitar que se sienta como un ranking
 * competitivo: "Así estamos avanzando juntos.") — se devuelve en el
 * mismo orden que useFamilyMembers (por fecha en que se unieron a la
 * familia).
 *
 * `mission_completions.xp_awarded` es el XP que esa misión completada
 * le sumó al Domio (no existe XP individual desde 0009_rewards_and_coins.sql)
 * — acá se usa "al revés" para ver cuánto aportó cada integrante al
 * total colectivo, no para puntuarlo a él. No hace falta filtrar por
 * family_id a mano: la policy de SELECT de mission_completions
 * ("Members can view their family's completions", 0001_init.sql) ya
 * solo deja ver las completadas de tu propia familia.
 *
 * "Semana" = desde el lunes 00:00 hasta ahora, en la hora LOCAL del
 * dispositivo (a diferencia de la racha familiar en
 * 0016_family_streak.sql, que usa el día del SERVIDOR — ahí importaba
 * menos porque cuenta días completos ya cerrados; acá el usuario
 * espera que el contador arranque de nuevo cada lunes según SU
 * reloj, así que el corte se calcula en el cliente).
 */
export function useWeeklyContributions(familyId: string | undefined) {
  return useQuery({
    queryKey: ["weekly-contributions", familyId],
    queryFn: async (): Promise<WeeklyContribution[]> => {
      const now = new Date();
      const dayIndex = now.getDay(); // 0 = domingo ... 6 = sábado
      const daysSinceMonday = (dayIndex + 6) % 7;
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

      // Traemos TODOS los integrantes primero — así quien no completó
      // nada esta semana igual aparece con 0xp, en vez de faltar de
      // la lista.
      const { data: members, error: membersError } = await supabase
        .from("family_members")
        .select("id, profiles(display_name)")
        .eq("family_id", familyId as string)
        .order("joined_at", { ascending: true });

      if (membersError) throw membersError;

      const { data: completions, error: completionsError } = await supabase
        .from("mission_completions")
        .select("family_member_id, xp_awarded")
        .eq("status", "completed")
        .gte("completed_at", startOfWeek.toISOString());

      if (completionsError) throw completionsError;

      const totals = new Map<string, number>();
      for (const c of completions ?? []) {
        totals.set(c.family_member_id, (totals.get(c.family_member_id) ?? 0) + c.xp_awarded);
      }

      return (members ?? []).map((m: any) => ({
        familyMemberId: m.id,
        displayName: m.profiles?.display_name ?? "—",
        xpThisWeek: totals.get(m.id) ?? 0,
      }));
    },
    enabled: !!familyId,
  });
}
