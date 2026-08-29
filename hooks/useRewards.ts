/**
 * Recompensas: listar las de la familia, crearlas (admin) y
 * reclamarlas gastando coins. Ver supabase/migrations/
 * 0009_rewards_and_coins.sql para el diseño completo (por que coins
 * es una moneda separada del xp, por que redeem_reward es una RPC en
 * vez de un update+insert sueltos, etc) y 0014_reward_redemption_limits.sql
 * para el limite de canjes (una vez / cada X dias).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Reward, RewardLockStatus, RewardRedemptionLimitType } from "@/types/domain";

export function useRewards(familyId: string | undefined) {
  return useQuery({
    queryKey: ["rewards", familyId],
    queryFn: async (): Promise<Reward[]> => {
      const { data, error } = await supabase
        .from("rewards")
        .select(
          "id, family_id, title, cost_coins, min_domio_level, is_family_reward, redemption_limit_type, cooldown_days",
        )
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
        redemptionLimitType: r.redemption_limit_type as RewardRedemptionLimitType,
        cooldownDays: r.cooldown_days,
      }));
    },
    enabled: !!familyId,
  });
}

/**
 * Si una recompensa esta bloqueada AHORA MISMO por su limite de
 * canjes, y desde cuando vuelve a estar disponible. No se puede
 * resolver leyendo reward_redemptions directo desde el cliente: la
 * policy de SELECT de esa tabla solo deja ver tus propios canjes (o
 * todos si sos admin) — un miembro comun no puede ver si OTRO
 * integrante ya canjeo una recompensa familiar. Por eso esto llama a
 * la RPC `reward_lock_status_for_family` (security definer, pero solo
 * expone booleanos/fechas — nunca quien canjeo que).
 */
export function useRewardLockStatus(familyId: string | undefined) {
  return useQuery({
    queryKey: ["reward-lock-status", familyId],
    queryFn: async (): Promise<Record<string, RewardLockStatus>> => {
      const { data, error } = await supabase.rpc("reward_lock_status_for_family", {
        target_family_id: familyId as string,
      });
      if (error) throw error;

      const byRewardId: Record<string, RewardLockStatus> = {};
      for (const row of data ?? []) {
        byRewardId[row.reward_id] = {
          isLocked: row.is_locked,
          availableAt: row.available_at,
        };
      }
      return byRewardId;
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
  redemptionLimitType: RewardRedemptionLimitType;
  /** Obligatorio (y solo se manda) cuando redemptionLimitType === "cooldown". */
  cooldownDays?: number;
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
        redemption_limit_type: input.redemptionLimitType,
        // El check constraint de 0014 exige null salvo en "cooldown".
        cooldown_days: input.redemptionLimitType === "cooldown" ? input.cooldownDays : null,
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
 * el limite de canjes, que el Domio haya llegado al nivel mínimo Y
 * que alcancen las coins, y descontarlas de forma atomica — por eso
 * vive del lado de Postgres (redeem_reward) en vez de un
 * select+update+insert sueltos desde aca (dos taps rapidos podrian
 * gastar coins que ya no estaban).
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
      // propia — invalidamos las dos claves que lo leen. El canje
      // tambien puede cambiar el estado de bloqueo de la recompensa
      // (once/cooldown), asi que invalidamos esa tambien.
      queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
      queryClient.invalidateQueries({ queryKey: ["family-member", userId] });
      queryClient.invalidateQueries({ queryKey: ["reward-lock-status", familyId] });
    },
  });
}
