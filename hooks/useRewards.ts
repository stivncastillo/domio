/**
 * Recompensas: listar las de la familia, crearlas (admin) y
 * reclamarlas gastando coins. Ver supabase/migrations/
 * 0009_rewards_and_coins.sql para el diseño completo (por que coins
 * es una moneda separada del xp, por que redeem_reward es una RPC en
 * vez de un update+insert sueltos, etc).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Reward } from "@/types/domain";

export function useRewards(familyId: string | undefined) {
  return useQuery({
    queryKey: ["rewards", familyId],
    queryFn: async (): Promise<Reward[]> => {
      const { data, error } = await supabase
        .from("rewards")
        .select("id, family_id, title, cost_coins, min_domio_level, is_family_reward")
        .eq("family_id", familyId as string)
        .order("cost_coins", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((r) => ({
        id: r.id,
        familyId: r.family_id,
        title: r.title,
        costCoins: r.cost_coins,
        minDomioLevel: r.min_domio_level,
        isFamilyReward: r.is_family_reward,
      }));
    },
    enabled: !!familyId,
  });
}

interface CreateRewardInput {
  familyId: string;
  title: string;
  costCoins: number;
  minDomioLevel: number;
  isFamilyReward: boolean;
}

// Crear recompensas es cosa del admin (0009: policy de INSERT en
// rewards exige is_admin_of_family) — mismo motivo que las misiones:
// si cualquiera pudiera crear una, le pondria costo 0 y nivel mínimo
// 1, y se la reclamaria gratis desde el arranque.
export function useCreateReward() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRewardInput) => {
      const { error } = await supabase.from("rewards").insert({
        family_id: input.familyId,
        title: input.title,
        cost_coins: input.costCoins,
        min_domio_level: input.minDomioLevel,
        is_family_reward: input.isFamilyReward,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rewards", variables.familyId] });
    },
  });
}

/**
 * Reclamar una recompensa no es un simple insert: hay que chequear
 * que el Domio haya llegado al nivel mínimo Y que alcancen las coins,
 * y descontarlas de forma atomica — por eso vive del lado de Postgres
 * (redeem_reward) en vez de un select+update+insert sueltos desde
 * aca (dos taps rapidos podrian gastar coins que ya no estaban).
 */
export function useRedeemReward(familyId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc("redeem_reward", { target_reward_id: rewardId });
      if (error) throw error;
    },
    onSuccess: () => {
      // El balance de coins vive en family_members, no en una query
      // propia — invalidamos las dos claves que lo leen.
      queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      queryClient.invalidateQueries({ queryKey: ["family-member", userId] });
    },
  });
}
