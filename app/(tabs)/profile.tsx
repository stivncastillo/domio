import { Text, View, Pressable } from "react-native";

import { supabase } from "@/lib/supabase";

export default function ProfileScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-domio-bg px-6">
      <Text className="text-xl text-white">Perfil — por implementar</Text>
      <Text className="mt-2 text-center text-domio-muted">
        Avatar, atuendos desbloqueados, estadisticas personales.
      </Text>
      <Pressable
        className="mt-6 rounded-xl bg-domio-danger px-4 py-3"
        onPress={() => supabase.auth.signOut()}
      >
        <Text className="font-semibold text-white">Cerrar sesion</Text>
      </Pressable>
    </View>
  );
}
