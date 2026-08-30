/**
 * Tab Perfil (2026-08-30): datos propios (nombre visible, editable) y
 * un resumen de "lo que hice esta semana" — a diferencia de "Equipo
 * Domio" en el Home (hooks/useFamily.ts, useWeeklyContributions), que
 * mira a TODA la familia y solo XP, acá es un solo integrante (yo) y
 * las tres métricas que tiene sentido resumir por persona: misiones
 * completadas, XP aportado al Domio, y coins ganadas.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

// ============================================================
// Actualizar nombre visible
// ============================================================

interface UpdateDisplayNameInput {
  userId: string;
  displayName: string;
}

export function useUpdateDisplayName(familyId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, displayName }: UpdateDisplayNameInput) => {
      const trimmed = displayName.trim();

      // La policy "A user can only edit their own profile" (0001_init.sql)
      // ya exige id = auth.uid() del lado del servidor — el .eq de acá
      // es ademas necesario para que el UPDATE no intente tocar (y
      // falle la RLS de) cualquier otra fila de profiles.
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmed })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      // El nombre visible se lee en varios lados via el embed
      // profiles(display_name): Home (myDisplayName, "Equipo Domio")
      // y tab Familia — todos cuelgan de family-members / weekly-
      // contributions, asi que invalidando esas dos alcanza para que
      // se vea el nombre nuevo en toda la app sin recargar.
      queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      queryClient.invalidateQueries({ queryKey: ["weekly-contributions", familyId] });
    },
  });
}

// ============================================================
// Resumen semanal personal
// ============================================================

export interface WeeklyPersonalSummary {
  missionsCompleted: number;
  xpEarned: number;
  coinsEarned: number;
}

const EMPTY_SUMMARY: WeeklyPersonalSummary = {
  missionsCompleted: 0,
  xpEarned: 0,
  coinsEarned: 0,
};

export function useWeeklyPersonalSummary(familyMemberId: string | undefined) {
  return useQuery({
    queryKey: ["weekly-personal-summary", familyMemberId],
    queryFn: async (): Promise<WeeklyPersonalSummary> => {
      // Mismo corte de "semana" que useWeeklyContributions (Equipo
      // Domio en el Home): lunes 00:00 en la hora LOCAL del
      // dispositivo, no la del servidor — el usuario espera que su
      // propio resumen arranque de nuevo cada lunes segun SU reloj.
      const now = new Date();
      const dayIndex = now.getDay(); // 0 = domingo ... 6 = sábado
      const daysSinceMonday = (dayIndex + 6) % 7;
      const startOfWeek = new Date(now);
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

      // mission_completions solo tiene filas 'completed' (complete_mission,
      // 0009_rewards_and_coins.sql, es el unico lugar que inserta acá;
      // los vencimientos de 0015 marcan `missions.status = 'failed'`
      // directo, sin pasar por esta tabla) — el filtro por status
      // queda igual solo para dejar la intención explícita, mismo
      // criterio que useWeeklyContributions.
      const { data, error } = await supabase
        .from("mission_completions")
        .select("xp_awarded, coins_awarded")
        .eq("family_member_id", familyMemberId as string)
        .eq("status", "completed")
        .gte("completed_at", startOfWeek.toISOString());

      if (error) throw error;
      if (!data || data.length === 0) return EMPTY_SUMMARY;

      return data.reduce(
        (acc, row) => ({
          missionsCompleted: acc.missionsCompleted + 1,
          xpEarned: acc.xpEarned + (row.xp_awarded ?? 0),
          coinsEarned: acc.coinsEarned + (row.coins_awarded ?? 0),
        }),
        { ...EMPTY_SUMMARY },
      );
    },
    enabled: !!familyMemberId,
  });
}
