import { Pressable, Text, View } from "react-native";

import type { Mission } from "@/types/domain";

interface MissionRowProps {
  mission: Pick<Mission, "title" | "xpReward" | "coinReward" | "status" | "type" | "assigneeName">;
  onToggle?: () => void;
}

export function MissionRow({ mission, onToggle }: MissionRowProps) {
  const isDone = mission.status === "completed";

  return (
    <Pressable
      onPress={onToggle}
      className="mb-2 flex-row items-center justify-between rounded-xl bg-domio-card px-4 py-3"
    >
      <View className="flex-1">
        <Text className={`text-base ${isDone ? "text-domio-muted line-through" : "text-white"}`}>
          {mission.title}
        </Text>
        {mission.type === "family" ? (
          <Text className="text-xs text-domio-secondary">👨‍👩‍👧 Familiar</Text>
        ) : (
          <Text className="text-xs text-domio-muted">
            {mission.assigneeName ? `Asignada a ${mission.assigneeName}` : "Sin asignar"}
          </Text>
        )}
      </View>
      <View className="items-end">
        <Text className="font-semibold text-domio-primary">+{mission.xpReward} XP</Text>
        {mission.type !== "family" && mission.coinReward > 0 && (
          <Text className="text-xs text-domio-secondary">+{mission.coinReward} 🪙</Text>
        )}
      </View>
    </Pressable>
  );
}
