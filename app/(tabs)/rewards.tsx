import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useFamilyMembers } from "@/hooks/useFamily";
import { useDomioProgress } from "@/hooks/useDomioProgress";
import { useRewards, useRewardLockStatus, useCreateReward, useRedeemReward } from "@/hooks/useRewards";
import type { RewardRedemptionLimitType } from "@/types/domain";

const rewardSchema = z
  .object({
    title: z.string().min(2, "Ponele un titulo"),
    costCoins: z.coerce.number().int().min(1, "Minimo 1 moneda").max(500, "Maximo 500"),
    // El Domio (no el integrante) tiene que llegar a este nivel para
    // que la recompensa se pueda reclamar, ademas de tener las coins.
    minDomioLevel: z.coerce.number().int().min(1, "Minimo nivel 1").max(99, "Maximo 99"),
    isFamilyReward: z.boolean(),
    // Limite de canjes (0014_reward_redemption_limits.sql): sin
    // limite, una sola vez, o cada X dias. El alcance (por integrante
    // o compartido por toda la familia) sigue a isFamilyReward.
    redemptionLimitType: z.enum(["unlimited", "once", "cooldown"]),
    cooldownDays: z.coerce.number().int().min(1, "Minimo 1 día").max(365, "Maximo 365").optional(),
  })
  .refine((values) => values.redemptionLimitType !== "cooldown" || !!values.cooldownDays, {
    message: "Decime cada cuántos días se puede reclamar",
    path: ["cooldownDays"],
  });

type RewardForm = z.infer<typeof rewardSchema>;

const LIMIT_OPTIONS: { value: RewardRedemptionLimitType; label: string }[] = [
  { value: "unlimited", label: "Sin límite" },
  { value: "once", label: "Una sola vez" },
  { value: "cooldown", label: "Cada X días" },
];

export default function RewardsScreen() {
  const [showForm, setShowForm] = useState(false);
  const { session } = useAuth();
  const { data: familyMember } = useCurrentFamilyMember(session?.user.id);
  const familyId = familyMember?.family_id as string | undefined;
  // Crear recompensas es cosa del admin (0009_rewards_and_coins.sql):
  // si cualquiera pudiera crear una, le pondria costo 0 y se la
  // reclamaria gratis.
  const isAdmin = familyMember?.role === "admin";

  const { data: rewards, isLoading } = useRewards(familyId);
  // Bloqueo por limite de canjes (once/cooldown) — viene de una RPC
  // aparte porque un miembro comun no puede ver los canjes de OTRO
  // integrante via RLS normal (ver hooks/useRewards.ts).
  const { data: lockStatusByRewardId } = useRewardLockStatus(familyId);
  // No hay un hook propio para "mis coins" — se lee de la misma lista
  // de integrantes que ya usa la tab Familia.
  const { data: familyMembers } = useFamilyMembers(familyId);
  const myCoins = familyMembers?.find((m) => m.profileId === session?.user.id)?.coins ?? 0;
  // El nivel que importa para reclamar es el del Domio, no el mío.
  const { data: domio } = useDomioProgress(familyId);
  const domioLevel = domio?.level ?? 1;

  const createReward = useCreateReward();
  const redeemReward = useRedeemReward(familyId, session?.user.id);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RewardForm>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
      title: "",
      costCoins: 20,
      minDomioLevel: 1,
      isFamilyReward: false,
      redemptionLimitType: "unlimited",
      cooldownDays: 15,
    },
  });

  const redemptionLimitType = watch("redemptionLimitType");

  const onSubmit = async (values: RewardForm) => {
    if (!familyId) return;
    await createReward.mutateAsync({ familyId, ...values });
    reset();
    setShowForm(false);
  };

  const onRedeem = async (rewardId: string) => {
    setRedeemingId(rewardId);
    try {
      await redeemReward.mutateAsync(rewardId);
    } catch (err: any) {
      // redeem_reward puede fallar si justo se gastaron las coins en
      // otro lado (o dos taps rapidos), o si el limite de canjes ya
      // no lo permite — el mensaje viene tal cual de la excepcion de
      // Postgres.
      Alert.alert("No se pudo reclamar", err.message ?? "Intenta de nuevo");
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <View className="flex-1 bg-domio-bg px-4 pt-16">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-white">Recompensas</Text>
        {isAdmin && (
          <Pressable
            className="rounded-full bg-domio-primary px-4 py-2"
            onPress={() => setShowForm((prev) => !prev)}
          >
            <Text className="font-semibold text-domio-bg">{showForm ? "Cancelar" : "+ Nueva"}</Text>
          </Pressable>
        )}
      </View>

      <Card className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-domio-muted">Tus monedas</Text>
          <Text className="text-xs text-domio-muted">Domio nivel {domioLevel}</Text>
        </View>
        <Text className="text-xl font-bold text-domio-secondary">🪙 {myCoins}</Text>
      </Card>

      {isAdmin && showForm && (
        <Card className="mb-4">
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="mb-2 rounded-xl bg-domio-bg px-4 py-3 text-white"
                placeholder="Titulo (ej: Elegir la peli del finde)"
                placeholderTextColor="#7A7F9A"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.title && <Text className="mb-2 text-domio-danger">{errors.title.message}</Text>}

          <Controller
            control={control}
            name="costCoins"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="mb-2 rounded-xl bg-domio-bg px-4 py-3 text-white"
                placeholder="Costo en monedas (ej: 20)"
                placeholderTextColor="#7A7F9A"
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={String(value)}
              />
            )}
          />
          {errors.costCoins && (
            <Text className="mb-2 text-domio-danger">{errors.costCoins.message}</Text>
          )}

          <Controller
            control={control}
            name="minDomioLevel"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="mb-2 rounded-xl bg-domio-bg px-4 py-3 text-white"
                placeholder="Nivel mínimo del Domio (ej: 1, sin requisito)"
                placeholderTextColor="#7A7F9A"
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={String(value)}
              />
            )}
          />
          {errors.minDomioLevel && (
            <Text className="mb-2 text-domio-danger">{errors.minDomioLevel.message}</Text>
          )}

          <Controller
            control={control}
            name="isFamilyReward"
            render={({ field: { onChange, value } }) => (
              <Pressable
                className="mb-2 flex-row items-center gap-2"
                onPress={() => onChange(!value)}
              >
                <View
                  className={`h-5 w-5 rounded border ${
                    value ? "border-domio-primary bg-domio-primary" : "border-domio-muted"
                  }`}
                />
                <Text className="text-white">Es una recompensa familiar</Text>
              </Pressable>
            )}
          />

          {/*
            Limite de canjes (0014_reward_redemption_limits.sql). El
            alcance sigue a "es recompensa familiar" de arriba: si es
            familiar el limite es compartido por toda la familia, si
            es individual cada integrante tiene su propio contador.
          */}
          <Text className="mb-2 mt-1 text-domio-muted">Límite de canjes</Text>
          <Controller
            control={control}
            name="redemptionLimitType"
            render={({ field: { onChange, value } }) => (
              <View className="mb-2 flex-row gap-2">
                {LIMIT_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    className={`flex-1 items-center rounded-xl py-2 ${
                      value === opt.value ? "bg-domio-primary" : "bg-domio-bg"
                    }`}
                    onPress={() => onChange(opt.value)}
                  >
                    <Text className={value === opt.value ? "text-domio-bg" : "text-white"}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />

          {redemptionLimitType === "cooldown" && (
            <>
              <Controller
                control={control}
                name="cooldownDays"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    className="mb-2 rounded-xl bg-domio-bg px-4 py-3 text-white"
                    placeholder="Cada cuántos días (ej: 15)"
                    placeholderTextColor="#7A7F9A"
                    keyboardType="numeric"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value ? String(value) : ""}
                  />
                )}
              />
              {errors.cooldownDays && (
                <Text className="mb-2 text-domio-danger">{errors.cooldownDays.message}</Text>
              )}
            </>
          )}

          <Pressable
            className="mt-2 items-center rounded-xl bg-domio-primary py-3"
            disabled={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          >
            <Text className="font-semibold text-domio-bg">
              {isSubmitting ? "Creando..." : "Crear recompensa"}
            </Text>
          </Pressable>
        </Card>
      )}

      {isLoading ? (
        <ActivityIndicator color="#F5B942" />
      ) : (
        <FlatList
          data={rewards ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-domio-muted">
              {isAdmin
                ? 'Todavia no hay recompensas. Creá la primera con "+ Nueva".'
                : "Todavia no hay recompensas para reclamar."}
            </Text>
          }
          renderItem={({ item }) => {
            // Tres condiciones tienen que cumplirse a la vez: el Domio
            // en el nivel pedido, las coins alcanzando, y el limite de
            // canjes sin bloquear (ver redeem_reward en
            // 0009_rewards_and_coins.sql / 0014_reward_redemption_limits.sql).
            const meetsLevel = domioLevel >= item.minDomioLevel;
            const canAfford = myCoins >= item.costCoins;
            const lockStatus = lockStatusByRewardId?.[item.id];
            const isLockedByLimit = lockStatus?.isLocked ?? false;
            const canRedeem = meetsLevel && canAfford && !isLockedByLimit;

            const limitLabel =
              item.redemptionLimitType === "once"
                ? "Una sola vez"
                : item.redemptionLimitType === "cooldown"
                  ? `Cada ${item.cooldownDays} días`
                  : null;

            return (
              <View className="mb-2 flex-row items-center justify-between rounded-xl bg-domio-card px-4 py-3">
                <View className="flex-1">
                  <Text className="text-base text-white">{item.title}</Text>
                  <Text className="text-xs text-domio-muted">
                    {item.isFamilyReward ? "👨‍👩‍👧 Familiar" : "Individual"} · {item.costCoins} 🪙
                    {item.minDomioLevel > 1 ? ` · Domio nivel ${item.minDomioLevel}` : ""}
                    {limitLabel ? ` · ${limitLabel}` : ""}
                  </Text>
                  {!meetsLevel && (
                    <Text className="text-xs text-domio-danger">
                      🔒 El Domio todavía no llegó a nivel {item.minDomioLevel}
                    </Text>
                  )}
                  {meetsLevel && isLockedByLimit && item.redemptionLimitType === "once" && (
                    <Text className="text-xs text-domio-danger">🔒 Ya fue reclamada (una sola vez)</Text>
                  )}
                  {meetsLevel && isLockedByLimit && item.redemptionLimitType === "cooldown" && (
                    <Text className="text-xs text-domio-danger">
                      🔒 Disponible de nuevo el{" "}
                      {lockStatus?.availableAt
                        ? new Date(lockStatus.availableAt).toLocaleDateString()
                        : "..."}
                    </Text>
                  )}
                </View>
                <Pressable
                  disabled={!canRedeem || redeemingId === item.id}
                  onPress={() => onRedeem(item.id)}
                  className={`rounded-xl px-3 py-2 ${
                    canRedeem ? "bg-domio-primary" : "bg-domio-bg"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      canRedeem ? "text-domio-bg" : "text-domio-muted"
                    }`}
                  >
                    {redeemingId === item.id ? "..." : "Reclamar"}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
