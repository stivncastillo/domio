import { Text, View } from "react-native";

export default function FamilyScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-domio-bg px-6">
      <Text className="text-xl text-white">Familia — por implementar</Text>
      <Text className="mt-2 text-center text-domio-muted">
        Lista de integrantes (`family_members`) con su nivel, XP y racha individual.
      </Text>
    </View>
  );
}
