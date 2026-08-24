import { ScrollView, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MissionRow } from "@/components/ui/MissionRow";
import { DomiAvatar } from "@/components/domi/DomiAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useMisiones, useCompleteMision } from "@/hooks/useMissions";
import { useDomioProgress } from "@/hooks/useDomioProgress";

/**
 * Dashboard principal — responde las 4 preguntas del brief:
 * 1) ¿Como esta mi Domio? 2) ¿Que tengo que hacer?
 * 3) ¿Como progresa mi familia? 4) ¿Que estamos intentando conseguir?
 *
 * "Reto familiar" y "Proxima recompensa" siguen siendo un ejemplo fijo:
 * retos y recompensas todavia no estan implementados (van despues de
 * misiones en el MVP).
 */
export default function DashboardScreen() {
  const { session } = useAuth();
  const { data: familyMember } = useCurrentFamilyMember(session?.user.id);
  const familyId = familyMember?.family_id as string | undefined;

  const { data: missions } = useMisiones(familyId);
  const { data: domio } = useDomioProgress(familyId);
  const completeMision = useCompleteMision(familyId, session?.user.id);

  const pendientes = (missions ?? []).filter((m) => m.status === "pendiente").slice(0, 3);
  const progress = domio && domio.xpToNextLevel > 0 ? domio.currentXp / domio.xpToNextLevel : 0;

  return (
    <ScrollView className="flex-1 bg-domio-bg px-4 pt-16" contentContainerStyle={{ gap: 16 }}>
      <View>
        <Text className="text-2xl font-bold text-white">Domio — Nivel {domio?.level ?? 1}</Text>
        <View className="mt-2">
          <ProgressBar progress={progress} />
        </View>
        <Text className="mt-1 text-domio-muted">
          🔥 Racha familiar: {domio?.familyStreakDays ?? 0} dias
        </Text>
      </View>

      <Card>
        <DomiAvatar />
      </Card>

      <View>
        <Text className="mb-2 text-lg font-semibold text-white">🎯 Mis misiones</Text>
        {pendientes.length === 0 ? (
          <Text className="text-domio-muted">No tenés misiones pendientes. 🎉</Text>
        ) : (
          pendientes.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              onToggle={() => completeMision.mutate(mission.id)}
            />
          ))
        )}
      </View>

      <Card>
        <Text className="mb-2 text-lg font-semibold text-white">🏆 Reto familiar</Text>
        <Text className="mb-2 text-domio-muted">Completar 50 misiones esta semana</Text>
        <ProgressBar progress={38 / 50} colorClassName="bg-domio-secondary" />
        <Text className="mt-1 text-right text-domio-muted">38 / 50</Text>
      </Card>

      <Card className="mb-8">
        <Text className="mb-1 text-lg font-semibold text-white">🎁 Proxima recompensa</Text>
        <Text className="text-domio-muted">🍕 Noche de pizza</Text>
      </Card>
    </ScrollView>
  );
}
