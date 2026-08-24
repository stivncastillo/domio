/**
 * Todo lo relacionado a leer/crear/completar misiones.
 *
 * Convencion: las queries a Supabase devuelven columnas snake_case (asi
 * viven en Postgres); estos hooks las mapean a los tipos camelCase de
 * types/domain.ts, asi el resto de la app (componentes, pantallas)
 * nunca tiene que pensar en snake_case.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Mission, MissionType } from "@/types/domain";

export function useMissions(familyId: string | undefined) {
  return useQuery({
    queryKey: ["missions", familyId],
    queryFn: async (): Promise<Mission[]> => {
      const { data, error } = await supabase
        .from("missions")
        .select("id, title, type, is_mandatory, xp_reward, status, due_at, family_id")
        .eq("family_id", familyId as string)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((m: any) => ({
        id: m.id,
        familyId: m.family_id,
        title: m.title,
        type: m.type,
        isMandatory: m.is_mandatory,
        xpReward: m.xp_reward,
        assignedTo: [],
        status: m.status,
        dueAt: m.due_at,
      }));
    },
    enabled: !!familyId,
  });
}

interface CreateMissionInput {
  familyId: string;
  createdBy: string;
  title: string;
  type: MissionType;
  isMandatory: boolean;
  xpReward: number;
}

export function useCreateMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMissionInput) => {
      const { error } = await supabase.from("missions").insert({
        family_id: input.familyId,
        created_by: input.createdBy,
        title: input.title,
        type: input.type,
        is_mandatory: input.isMandatory,
        xp_reward: input.xpReward,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["missions", variables.familyId] });
    },
  });
}

/**
 * Completar una mision no es un simple UPDATE: tiene que registrar el
 * completado, sumar XP individual (y recalcular nivel), y sumar XP al
 * Domio (con su propio nivel). Por eso vive del lado de Postgres como
 * una funcion (`complete_mission`, ver supabase/migrations/
 * 0003_missions.sql) en vez de hacerse a los ponchazos desde el
 * cliente con 3-4 llamadas sueltas (que ademas no serian atomicas).
 */
export function useCompleteMission(familyId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (missionId: string) => {
      const { error } = await supabase.rpc("complete_mission", {
        target_mission_id: missionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions", familyId] });
      queryClient.invalidateQueries({ queryKey: ["family-member", userId] });
      queryClient.invalidateQueries({ queryKey: ["domio-progress", familyId] });
    },
  });
}
