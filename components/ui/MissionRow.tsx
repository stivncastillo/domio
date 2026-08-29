import { Pressable, Text, View } from "react-native";

import type { Mission } from "@/types/domain";

interface MissionRowProps {
  mission: Pick<
    Mission,
    | "title"
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
}

export function MissionRow({ mission, onToggle }: MissionRowProps) {
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
