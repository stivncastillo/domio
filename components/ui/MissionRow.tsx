import { Pressable, Text, View } from "react-native";

import type { Mission } from "@/types/domain";

interface MissionRowProps {
  mission: Pick<Mission, "title" | "emoji" | "xpReward" | "status" | "type">;
  onToggle?: () => void;
}

export function MissionRow({ mission, onToggle }: MissionRowProps) {
  const isDone = mission.status === "completada";

  return (
    <Pressable
      onPress={onToggle}
      className="mb-2 flex-row items-center justify-between rounded-xl bg-domio-card px-4 py-3"
    >
      <View className="flex-1 flex-row items-center gap-3">
        <Text className="text-xl">{mission.emoji}</Text>
        <View className="flex-1">
          <Text
            className={`text-base ${isDone ? "text-domio-muted line-through" : "text-white"}`}
          >
            {mission.title}
          </Text>
          {mission.type === "familiar" && (
            <Text className="text-xs text-domio-secondary">
              👨‍👩‍👧 Familiar — el XP va al Domio
            </Text>
          )}
        </View>
      </View>
      <Text className="font-semibold text-domio-primary">+{mission.xpReward} XP</Text>
    </Pressable>
  );
}
