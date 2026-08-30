import { Pressable, Text, View } from "react-native";

import { MISSION_COMPLEXITY_LABELS, type Mission } from "@/types/domain";

// Un color por complejidad (0017_mission_complexity.sql) — mismo
// criterio visual que ya usaba el resto de la app (danger para "cosas
// que importan", secondary/muted para info neutra).
const COMPLEXITY_COLOR: Record<Mission["complexity"], string> = {
  low: "text-domio-muted",
  medium: "text-domio-secondary",
  high: "text-domio-danger",
};

interface MissionRowProps {
  mission: Pick<
    Mission,
    | "title"
    | "complexity"
    | "xpReward"
    | "coinReward"
    | "status"
    | "type"
    | "assigneeName"
    | "isMandatory"
    | "dueAt"
    | "xpPenalty"
  >;
  onToggle?: () => void;
  /**
   * Bug real (2026-08-30, Stiven): un admin podia completar misiones
   * "single" asignadas a OTRO integrante, porque veia todas las
   * misiones de su familia (RLS de SELECT, 0008) y esa visibilidad se
   * colaba como permiso de completar. `onToggle` ahora solo llega
   * definido cuando quien mira la pantalla puede completar esta
   * mision de verdad (ver app/(tabs)/missions.tsx y (tabs)/index.tsx,
   * mismo criterio que valida 0018_complete_mission_assignee_check.sql
   * del lado de la base) — cuando no puede, el padre manda este texto
   * en vez de un onToggle, para que quede claro por que no es tocable.
   */
  lockedReason?: string;
}

export function MissionRow({ mission, onToggle, lockedReason }: MissionRowProps) {
  const isDone = mission.status === "completed";
  const isFailed = mission.status === "failed";

  return (
    <Pressable
      onPress={onToggle}
      className="mb-2 flex-row items-center justify-between rounded-xl bg-domio-card px-4 py-3"
    >
      <View className="flex-1">
        <Text
          className={`text-base ${isDone || isFailed ? "text-domio-muted line-through" : "text-white"}`}
        >
          {mission.title}
        </Text>
        {mission.type === "family" ? (
          <Text className="text-xs text-domio-secondary">👨‍👩‍👧 Familiar</Text>
        ) : (
          <Text className="text-xs text-domio-muted">
            {mission.assigneeName ? `Asignada a ${mission.assigneeName}` : "Sin asignar"}
          </Text>
        )}
        <Text className={`text-xs ${COMPLEXITY_COLOR[mission.complexity]}`}>
          Complejidad: {MISSION_COMPLEXITY_LABELS[mission.complexity]}
        </Text>
        {isFailed ? (
          // 0015_mission_deadlines_and_penalties.sql: process_overdue_missions
          // ya le resto el XP al Domio en el momento en que vencio —
          // esto solo es el registro visible de "que paso" en la lista.
          <Text className="text-xs text-domio-danger">
            ❌ No se cumplió a tiempo — el Domio perdió {mission.xpPenalty} XP
          </Text>
        ) : (
          mission.isMandatory &&
          mission.dueAt && (
            <Text className="text-xs text-domio-danger">
              ⏰ Vence {new Date(mission.dueAt).toLocaleString()} · -{mission.xpPenalty} XP si no
              se cumple
            </Text>
          )
        )}
        {lockedReason && <Text className="text-xs text-domio-muted">🔒 {lockedReason}</Text>}
      </View>
      <View className="items-end">
        <Text className="font-semibold text-domio-primary">+{mission.xpReward} XP</Text>
        {/*
          Antes esto se ocultaba para misiones "family"
          (`mission.type !== "family" && ...`) — quedo asi de cuando
          las coins todavia solo se pagaban en "single". Desde
          0011_family_mission_coins.sql las coins se pagan en los dos
          tipos, asi que el badge tiene que mostrarse en los dos.
        */}
        {mission.coinReward > 0 && (
          <Text className="text-xs text-domio-secondary">+{mission.coinReward} 🪙</Text>
        )}
      </View>
    </Pressable>
  );
}
