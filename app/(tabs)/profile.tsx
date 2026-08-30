/**
 * Tab Perfil (2026-08-30): primera implementación real — hasta ahora
 * era un placeholder con solo el botón de cerrar sesión. Alcance
 * acordado con Stiven: actualizar el nombre visible, un resumen
 * semanal de actividad propia (misiones completadas, XP aportado al
 * Domio, coins ganadas), y cerrar sesión (se conserva el botón que ya
 * existía). Avatar/atuendos desbloqueados quedan pendientes — no hay
 * todavía ningún sistema de atuendos en el resto de la app.
 */
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert } from "react-native";

import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useFamilyMembers } from "@/hooks/useFamily";
import { useUpdateDisplayName, useWeeklyPersonalSummary } from "@/hooks/useProfile";

export default function ProfileScreen() {
  const { session } = useAuth();
  const { data: familyMember } = useCurrentFamilyMember(session?.user.id);
  const familyId = familyMember?.family_id as string | undefined;

  // Mismo patrón que el Home (app/(tabs)/index.tsx): no hay un hook
  // propio para "mi perfil", se lee de la misma lista de integrantes
  // que ya usan Home y la tab Familia — así el nombre se mantiene
  // consistente en toda la app sin duplicar la fuente de verdad.
  const { data: familyMembers } = useFamilyMembers(familyId);
  const me = familyMembers?.find((m) => m.profileId === session?.user.id);

  const { data: weeklySummary } = useWeeklyPersonalSummary(familyMember?.id);
  const updateDisplayName = useUpdateDisplayName(familyId);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // Si `me` todavía no cargó (o cambia desde otro dispositivo) y no
  // estamos editando, el input siempre refleja el nombre guardado —
  // mismo criterio que useForm con defaultValues, pero acá no hace
  // falta react-hook-form para un solo campo.
  useEffect(() => {
    if (!isEditingName) setNameDraft(me?.displayName ?? "");
  }, [me?.displayName, isEditingName]);

  const startEditing = () => {
    setNameDraft(me?.displayName ?? "");
    setIsEditingName(true);
  };

  const cancelEditing = () => {
    setNameDraft(me?.displayName ?? "");
    setIsEditingName(false);
  };

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!session?.user.id) return;

    if (trimmed.length < 2) {
      Alert.alert("Nombre muy corto", "Poné al menos 2 caracteres.");
      return;
    }

    updateDisplayName.mutate(
      { userId: session.user.id, displayName: trimmed },
      {
        onSuccess: () => setIsEditingName(false),
        onError: (error) =>
          Alert.alert("No se pudo guardar", error instanceof Error ? error.message : String(error)),
      },
    );
  };

  const handleSignOut = () => {
    // Confirmación antes de cerrar sesión — antes el botón cerraba
    // sesión con un solo tap sin ningún tipo de aviso.
    Alert.alert("Cerrar sesión", "¿Seguro que querés salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-domio-bg px-4 pt-16" contentContainerStyle={{ gap: 16 }}>
      <Text className="text-2xl font-bold text-white">Mi perfil</Text>

      <Card>
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-domio-secondary">
          Nombre visible
        </Text>
        {isEditingName ? (
          <View>
            <TextInput
              className="mb-2 rounded-xl bg-domio-bg px-4 py-3 text-white"
              placeholder="Tu nombre"
              placeholderTextColor="#7A7F9A"
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
            />
            <View className="flex-row gap-2">
              <Pressable
                className="flex-1 items-center rounded-xl bg-domio-primary py-3"
                disabled={updateDisplayName.isPending}
                onPress={saveName}
              >
                <Text className="font-semibold text-white">
                  {updateDisplayName.isPending ? "Guardando..." : "Guardar"}
                </Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center rounded-xl bg-domio-card py-3"
                disabled={updateDisplayName.isPending}
                onPress={cancelEditing}
              >
                <Text className="font-semibold text-domio-muted">Cancelar</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-between">
            <Text className="text-lg text-white">{me?.displayName ?? "—"}</Text>
            <Pressable onPress={startEditing}>
              <Text className="text-sm text-domio-secondary">Editar</Text>
            </Pressable>
          </View>
        )}
      </Card>

      <Card>
        <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-domio-secondary">
          📆 Esta semana
        </Text>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-white">Misiones completadas</Text>
          <Text className="font-semibold text-domio-primary">
            {weeklySummary?.missionsCompleted ?? 0}
          </Text>
        </View>
        <View className="mb-2 flex-row justify-between">
          <Text className="text-white">XP aportado al Domio</Text>
          <Text className="font-semibold text-domio-primary">{weeklySummary?.xpEarned ?? 0} XP</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-white">Monedas ganadas</Text>
          <Text className="font-semibold text-domio-secondary">
            {weeklySummary?.coinsEarned ?? 0} 🪙
          </Text>
        </View>
      </Card>

      <Pressable
        className="mb-8 mt-2 items-center rounded-xl bg-domio-danger px-4 py-3"
        onPress={handleSignOut}
      >
        <Text className="font-semibold text-white">Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}
