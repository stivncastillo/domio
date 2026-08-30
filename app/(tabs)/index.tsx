import { ScrollView, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MissionRow } from "@/components/ui/MissionRow";
import { DomiAvatar } from "@/components/domi/DomiAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useMissions, useCompleteMission } from "@/hooks/useMissions";
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

  const { data: missions } = useMissions(familyId);
  const { data: domio } = useDomioProgress(familyId);
  const completeMission = useCompleteMission(familyId, session?.user.id);

  const pending = (missions ?? []).filter((m) => m.status === "pending").slice(0, 3);
  const progress = domio && domio.xpToNextLevel > 0 ? domio.currentXp / domio.xpToNextLevel : 0;
  // xpToNextLevel es el UMBRAL del nivel actual (no un "restante" —
  // ver hooks/useDomioProgress.ts / 0012_domio_level_curve.sql), asi
  // que lo que falta para subir de nivel es la resta. El Math.max es
  // solo defensivo (no deberia pasar currentXp > xpToNextLevel, el
  // trigger de complete_mission sube de nivel apenas se cruza el
  // umbral) para no mostrar "Faltan -20 XP" si algun dato queda
  // desincronizado un instante.
  const xpRemaining = domio ? Math.max(domio.xpToNextLevel - domio.currentXp, 0) : 0;

  return (
    <ScrollView className="flex-1 bg-domio-bg px-4 pt-16" contentContainerStyle={{ gap: 16 }}>
      <View>
        <Text className="text-2xl font-bold text-white">Domio — Nivel {domio?.level ?? 1}</Text>
        <View className="mt-2">
          <ProgressBar progress={progress} />
          <View className="mt-1 flex-row justify-between">
            <Text className="text-xs text-domio-muted">
              {domio?.currentXp ?? 0} / {domio?.xpToNextLevel ?? 0} XP
            </Text>
            <Text className="text-xs font-semibold text-domio-primary">
              Faltan {xpRemaining} XP para el nivel {(domio?.level ?? 1) + 1}
            </Text>
          </View>
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
        {pending.length === 0 ? (
          <Text className="text-domio-muted">No tenés misiones pendientes. 🎉</Text>
        ) : (
          pending.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              onToggle={() => completeMission.mutate(mission.id)}
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
