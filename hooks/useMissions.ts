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
      // El embed `mission_assignees(family_members(profiles(display_name)))`
      // sigue las foreign keys automaticamente (mission_assignees.family_member_id
      // -> family_members.id -> family_members.profile_id -> profiles.id) —
      // PostgREST arma el join solo, no hace falta escribirlo a mano. Ojo:
      // esto solo trae las misiones que la RLS de missions te deja ver
      // (ver 0008_mission_roles_and_assignment.sql) — un miembro comun
      // recibe solo las suyas + las familiares, no todas las de la familia.
      const { data, error } = await supabase
        .from("missions")
        .select(
          "id, title, type, is_mandatory, xp_reward, coin_reward, status, due_at, xp_penalty, family_id, mission_assignees(family_member_id, family_members(profiles(display_name)))",
        )
        .eq("family_id", familyId as string)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((m: any) => {
        const assignee = m.mission_assignees?.[0];
        return {
          id: m.id,
          familyId: m.family_id,
          title: m.title,
          type: m.type,
          isMandatory: m.is_mandatory,
          xpReward: m.xp_reward,
          coinReward: m.coin_reward,
          assignedTo: assignee ? [assignee.family_member_id] : [],
          assigneeName: assignee?.family_members?.profiles?.display_name ?? null,
          status: m.status,
          dueAt: m.due_at,
          xpPenalty: m.xp_penalty,
        };
      });
    },
    enabled: !!familyId,
  });
}

interface CreateMissionInput {
  familyId: string;
  // No hace falta pasar quien crea: create_mission usa auth.uid()
  // internamente (igual que create_family/join_family).
  title: string;
  type: MissionType;
  isMandatory: boolean;
  xpReward: number;
  /** Solo se paga en misiones "single" (ver complete_mission, 0009). */
  coinReward: number;
  /** id de family_members (no de profiles) — obligatorio para type "single". */
  assigneeFamilyMemberId?: string;
  /**
   * Vencimiento (0015): obligatorios los dos juntos cuando isMandatory
   * es true, ausentes cuando es false — validado en el form (zod) Y en
   * la RPC/constraint del lado de la base.
   */
  dueAt?: string; // ISO date
  xpPenalty?: number;
}

export function useCreateMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMissionInput) => {
      // RPC create_mission (0010_create_mission_rpc.sql), no dos
      // inserts sueltos: un INSERT con `.select().single()` sobre
      // missions explotaba con "violates row-level security policy"
      // (codigo 42501) — el RETURNING del insert exige pasar TAMBIEN
      // la policy de SELECT (can_view_mission), y eso fallaba en el
      // contexto puntual de RETURNING aunque is_admin_of_family diera
      // true y un SELECT normal aparte encontrara la fila sin
      // problema (mismo bug de fondo que ya resolvimos para
      // create_family). La RPC, al ser security definer, hace el
      // RETURNING interno sin pasar por esa policy — y de paso evita
      // tener que adivinar "cual mision se acaba de crear" con un
      // select ordenado por fecha (una condicion de carrera real si
      // se crean dos casi al mismo tiempo).
      const { error } = await supabase.rpc("create_mission", {
        target_family_id: input.familyId,
        mission_title: input.title,
        mission_type: input.type,
        mission_is_mandatory: input.isMandatory,
        mission_xp_reward: input.xpReward,
        mission_coin_reward: input.coinReward,
        assignee_family_member_id: input.assigneeFamilyMemberId ?? null,
        mission_due_at: input.dueAt ?? null,
        mission_xp_penalty: input.xpPenalty ?? 0,
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

      // Racha familiar (0016_family_streak.sql): se recalcula ACA
      // ademas de en hooks/useRealtimeSync.ts (que la recalcula cada
      // vez que alguien abre la app) para que suba al toque el mismo
      // dia en que se completa la primera mision, sin esperar a que
      // alguien vuelva a entrar a la app. Es idempotente (recalcula
      // desde el historial real, no incrementa un contador) asi que
      // llamarla desde los dos lugares no genera doble conteo.
      if (familyId) {
        const { error: streakError } = await supabase.rpc("recompute_family_streak", {
          target_family_id: familyId,
        });
        if (streakError) {
          console.warn("No se pudo recalcular la racha familiar:", streakError.message);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions", familyId] });
      queryClient.invalidateQueries({ queryKey: ["family-member", userId] });
      queryClient.invalidateQueries({ queryKey: ["domio-progress", familyId] });
    },
  });
}
