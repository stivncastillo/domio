import { Text, View } from "react-native";

export default function RewardsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-domio-bg px-6">
      <Text className="text-xl text-white">Recompensas — por implementar</Text>
      <Text className="mt-2 text-center text-domio-muted">
        Recompensas individuales vs familiares (`rewards`), reclamables con puntos.
      </Text>
    </View>
  );
}
