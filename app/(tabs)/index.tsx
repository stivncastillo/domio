import { ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";

import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MissionRow } from "@/components/ui/MissionRow";
import { DomiAvatar } from "@/components/domi/DomiAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useMissions, useCompleteMission } from "@/hooks/useMissions";
import { useDomioProgress } from "@/hooks/useDomioProgress";
import { useFamily, useFamilyMembers, useWeeklyContributions } from "@/hooks/useFamily";
import { useRewards, useRewardLockStatus } from "@/hooks/useRewards";

/**
 * Dashboard principal — rediseñado 2026-08-30 a partir de un pedido
 * concreto de Stiven con el layout completo del MVP (ver README,
 * sección "Rediseño del Home"). Responde las mismas 4 preguntas del
 * brief original (¿Cómo está mi Domio? ¿Qué tengo que hacer? ¿Cómo
 * progresa mi familia? ¿Qué estamos intentando conseguir?), pero ahora
 * con datos reales en TODAS las secciones — ya no queda ningún
 * hardcode tipo "Reto familiar: 38/50".
 */
export default function DashboardScreen() {
  const { session } = useAuth();
  const { data: familyMember } = useCurrentFamilyMember(session?.user.id);
  const familyId = familyMember?.family_id as string | undefined;

  const { data: missions } = useMissions(familyId);
  const { data: domio } = useDomioProgress(familyId);
  const { data: family } = useFamily(familyId);
  const { data: familyMembers } = useFamilyMembers(familyId);
  const { data: weeklyContributions } = useWeeklyContributions(familyId);
  const { data: rewards } = useRewards(familyId);
  const { data: rewardLockStatus } = useRewardLockStatus(familyId);
  const completeMission = useCompleteMission(familyId, session?.user.id);

  // No hay un hook propio para "mi nombre"/"mis coins" — ya se leen
  // de la misma lista de integrantes que usa la tab Familia (mismo
  // patrón que app/(tabs)/rewards.tsx con myCoins).
  const me = familyMembers?.find((m) => m.profileId === session?.user.id);
  const myDisplayName = me?.displayName;
  const myCoins = me?.coins ?? 0;
  const domioLevel = domio?.level ?? 1;

  // "Mis misiones" (2026-08-30): a diferencia de la version anterior
  // (que mostraba las primeras 3 misiones pendientes de TODA la
  // familia, visibles o no para el admin), ahora filtra de verdad por
  // "asignada a mi" — mismo criterio que ya se valida del lado de la
  // base en complete_mission (0018_complete_mission_assignee_check.sql).
  // Como el filtro ya garantiza que son completables por mi, no hace
  // falta el chequeo canCompleteMission/lockedReason que se uso antes
  // de este rediseño: todo lo que aparece aca SI se puede completar.
  const myMissions = (missions ?? [])
    .filter(
      (m) =>
        m.status === "pending" && m.type !== "family" && !!familyMember && m.assignedTo.includes(familyMember.id),
    )
    .slice(0, 3);

  // "Misiones familiares" (2026-08-30): reemplaza el card fijo de
  // "Reto familiar" (38/50 hardcodeado) por las misiones reales de
  // tipo "family" pendientes — cualquier integrante puede completar
  // cualquiera de estas (ver 0011_family_mission_coins.sql). El
  // mecanismo de "completá X esta semana y ganen tal recompensa" que
  // pidió Stiven queda para más adelante (anotado en el README) — por
  // ahora esto es simplemente la lista real.
  const familyMissions = (missions ?? []).filter((m) => m.status === "pending" && m.type === "family").slice(0, 5);

  const progress = domio && domio.xpToNextLevel > 0 ? domio.currentXp / domio.xpToNextLevel : 0;
  // xpToNextLevel es el UMBRAL del nivel actual (no un "restante" —
  // ver hooks/useDomioProgress.ts / 0012_domio_level_curve.sql), asi
  // que lo que falta para subir de nivel es la resta. El Math.max es
  // solo defensivo (no deberia pasar currentXp > xpToNextLevel, el
  // trigger de complete_mission sube de nivel apenas se cruza el
  // umbral) para no mostrar "Faltan -20 XP" si algun dato queda
  // desincronizado un instante.
  const xpRemaining = domio ? Math.max(domio.xpToNextLevel - domio.currentXp, 0) : 0;

  // "EQUIPO DOMIO" (2026-08-30): Stiven pidió explícitamente que esto
  // NO se sienta como un ranking ("Así estamos avanzando juntos.") —
  // por eso useWeeklyContributions devuelve a los integrantes en el
  // mismo orden que se unieron a la familia, no ordenados por XP, y
  // acá tampoco se re-ordenan.
  const weeklyTotal = (weeklyContributions ?? []).reduce((sum, c) => sum + c.xpThisWeek, 0);

  // Recompensas: mismas 3 condiciones que ya valida redeem_reward
  // (0009_rewards_and_coins.sql / 0014_reward_redemption_limits.sql),
  // reusadas acá solo para decidir en qué card entra cada una — el
  // botón de reclamar en si sigue viviendo únicamente en la tab
  // Recompensas, este es solo un vistazo.
  const availableRewards = (rewards ?? [])
    .filter(
      (r) =>
        domioLevel >= r.minDomioLevel && myCoins >= r.costCoins && !(rewardLockStatus?.[r.id]?.isLocked ?? false),
    )
    .slice(0, 3);

  // "Próximas recompensas en el siguiente nivel": las que se
  // desbloquean apenas el Domio suba UN nivel más — un teaser de "que
  // sigue", no todo lo que falta desbloquear a futuro.
  const nextLevelRewards = (rewards ?? []).filter((r) => r.minDomioLevel === domioLevel + 1).slice(0, 3);

  return (
    <ScrollView className="flex-1 bg-domio-bg px-4 pt-16" contentContainerStyle={{ gap: 16 }}>
      <View>
        <Text className="text-2xl font-bold text-white">
          Hola{myDisplayName ? `, ${myDisplayName}` : ""} 👋
        </Text>
        <Text className="mt-1 text-lg font-semibold text-domio-primary">
          {family?.name ?? "Tu Domio"} — Nivel {domioLevel}
        </Text>
      </View>

      <Card>
        <DomiAvatar />
      </Card>

      <View>
        <ProgressBar progress={progress} />
        <View className="mt-1 flex-row justify-between">
          <Text className="text-xs text-domio-muted">
            {domio?.currentXp ?? 0} / {domio?.xpToNextLevel ?? 0} XP
          </Text>
          <Text className="text-xs font-semibold text-domio-primary">
            Faltan {xpRemaining} XP para el nivel {domioLevel + 1}
          </Text>
        </View>
        <Text className="mt-1 text-domio-muted">
          🔥 Racha familiar: {domio?.familyStreakDays ?? 0} dias
        </Text>
      </View>

      <View>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-white">🎯 Mis misiones</Text>
          <Link href="/(tabs)/missions" className="text-sm text-domio-secondary">
            Ver todas →
          </Link>
        </View>
        {myMissions.length === 0 ? (
          <Text className="text-domio-muted">No tenés misiones pendientes. 🎉</Text>
        ) : (
          myMissions.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              onToggle={() => completeMission.mutate(mission.id)}
            />
          ))
        )}
      </View>

      <Card>
        <Text className="mb-2 text-lg font-semibold text-white">👨‍👩‍👧 Misiones familiares</Text>
        {familyMissions.length === 0 ? (
          <Text className="text-domio-muted">No hay misiones familiares pendientes.</Text>
        ) : (
          familyMissions.map((mission) => (
            <MissionRow
              key={mission.id}
              mission={mission}
              onToggle={() => completeMission.mutate(mission.id)}
            />
          ))
        )}
      </Card>

      <Card>
        <Text className="text-xs font-semibold uppercase tracking-wide text-domio-secondary">
          🤝 Equipo Domio
        </Text>
        <Text className="mb-3 mt-1 text-domio-muted">Así estamos avanzando juntos.</Text>
        {(weeklyContributions ?? []).map((c) => (
          <View key={c.familyMemberId} className="mb-1 flex-row justify-between">
            <Text className="text-white">{c.displayName}</Text>
            <Text className="text-domio-primary">{c.xpThisWeek} XP</Text>
          </View>
        ))}
        <View className="mt-2 flex-row justify-between border-t border-domio-bg pt-2">
          <Text className="font-semibold text-white">XP esta semana</Text>
          <Text className="font-semibold text-domio-primary">{weeklyTotal} XP</Text>
        </View>
      </Card>

      <Card>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-white">🎁 Recompensas disponibles</Text>
          <Link href="/(tabs)/rewards" className="text-sm text-domio-secondary">
            Ver todas →
          </Link>
        </View>
        {availableRewards.length === 0 ? (
          <Text className="text-domio-muted">
            Todavía no tenés ninguna a mano — sumá más XP y coins.
          </Text>
        ) : (
          availableRewards.map((reward) => (
            <View key={reward.id} className="mb-1 flex-row justify-between">
              <Text className="text-white">{reward.title}</Text>
              <Text className="text-domio-secondary">{reward.costCoins} 🪙</Text>
            </View>
          ))
        )}
      </Card>

      <Card className="mb-8">
        <Text className="mb-2 text-lg font-semibold text-white">
          🔜 Se desbloquea en el nivel {domioLevel + 1}
        </Text>
        {nextLevelRewards.length === 0 ? (
          <Text className="text-domio-muted">Nada nuevo todavía para el próximo nivel.</Text>
        ) : (
          nextLevelRewards.map((reward) => (
            <View key={reward.id} className="mb-1 flex-row justify-between">
              <Text className="text-white">{reward.title}</Text>
              <Text className="text-domio-secondary">{reward.costCoins} 🪙</Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
