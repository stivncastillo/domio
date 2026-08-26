import { Text, View, Pressable, FlatList, ActivityIndicator, Share } from "react-native";

import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useFamily, useFamilyMembers } from "@/hooks/useFamily";

export default function FamilyScreen() {
  const { session } = useAuth();
  const { data: familyMember } = useCurrentFamilyMember(session?.user.id);
  const familyId = familyMember?.family_id as string | undefined;

  const { data: family, isLoading: isFamilyLoading } = useFamily(familyId);
  const { data: members, isLoading: isMembersLoading } = useFamilyMembers(familyId);

  const onShareCode = async () => {
    if (!family) return;
    // Share.share es la API nativa de RN para el sheet de compartir del
    // sistema (WhatsApp, Mensajes, copiar, etc.) — no hace falta ninguna
    // libreria extra.
    await Share.share({
      message: `Unite a nuestro Domio "${family.name}" con el código: ${family.inviteCode}`,
    });
  };

  if (isFamilyLoading || isMembersLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-domio-bg">
        <ActivityIndicator color="#F5B942" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-domio-bg px-4 pt-16">
      <Text className="mb-4 text-2xl font-bold text-white">{family?.name ?? "Familia"}</Text>

      <Card className="mb-4">
        <Text className="mb-1 text-domio-muted">Código de invitación</Text>
        <Text className="mb-3 text-2xl font-bold tracking-widest text-white">
          {family?.inviteCode}
        </Text>
        <Pressable className="items-center rounded-xl bg-domio-primary py-3" onPress={onShareCode}>
          <Text className="font-semibold text-domio-bg">Compartir código</Text>
        </Pressable>
      </Card>

      <Text className="mb-2 text-lg font-semibold text-white">Integrantes</Text>
      <FlatList
        data={members ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View className="mb-2 flex-row items-center justify-between rounded-xl bg-domio-card px-4 py-3">
            <View>
              <Text className="text-base text-white">
                {item.displayName}
                {item.profileId === session?.user.id ? " (vos)" : ""}
              </Text>
              <Text className="text-xs text-domio-muted">
                {item.role === "admin" ? "Admin" : "Miembro"} · 🔥 {item.streakDays} dias
              </Text>
            </View>
            <Text className="font-semibold text-domio-secondary">🪙 {item.coins}</Text>
          </View>
        )}
      />
    </View>
  );
}
