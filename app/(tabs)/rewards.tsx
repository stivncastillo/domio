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
import { useRewards, useCreateReward, useRedeemReward } from "@/hooks/useRewards";

const rewardSchema = z.object({
  title: z.string().min(2, "Ponele un titulo"),
  costCoins: z.coerce.number().int().min(1, "Minimo 1 moneda").max(500, "Maximo 500"),
  // El Domio (no el integrante) tiene que llegar a este nivel para
  // que la recompensa se pueda reclamar, ademas de tener las coins.
  minDomioLevel: z.coerce.number().int().min(1, "Minimo nivel 1").max(99, "Maximo 99"),
  isFamilyReward: z.boolean(),
});

type RewardForm = z.infer<typeof rewardSchema>;

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
    formState: { errors, isSubmitting },
  } = useForm<RewardForm>({
    resolver: zodResolver(rewardSchema),
    defaultValues: { title: "", costCoins: 20, minDomioLevel: 1, isFamilyReward: false },
  });

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
      // otro lado (o dos taps rapidos) — el mensaje viene tal cual de
      // la excepcion de Postgres.
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
            // Las dos condiciones tienen que cumplirse a la vez: el
            // Domio en el nivel pedido Y las coins alcanzando (ver
            // redeem_reward en 0009_rewards_and_coins.sql).
            const meetsLevel = domioLevel >= item.minDomioLevel;
            const canAfford = myCoins >= item.costCoins;
            const canRedeem = meetsLevel && canAfford;
            return (
              <View className="mb-2 flex-row items-center justify-between rounded-xl bg-domio-card px-4 py-3">
                <View className="flex-1">
                  <Text className="text-base text-white">{item.title}</Text>
                  <Text className="text-xs text-domio-muted">
                    {item.isFamilyReward ? "👨‍👩‍👧 Familiar" : "Individual"} · {item.costCoins} 🪙
                    {item.minDomioLevel > 1 ? ` · Domio nivel ${item.minDomioLevel}` : ""}
                  </Text>
                  {!meetsLevel && (
                    <Text className="text-xs text-domio-danger">
                      🔒 El Domio todavía no llegó a nivel {item.minDomioLevel}
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
