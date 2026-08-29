import { Tabs } from "expo-router";
import { Text, View } from "react-native";

import { MissionPenaltyCard } from "@/components/domi/MissionPenaltyCard";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

/**
 * Expo Router: cada archivo dentro de app/(tabs)/ es un tab automatico.
 * `tabBarIcon` normalmente usa @expo/vector-icons; por simplicidad
 * arrancamos con emojis como placeholder.
 */
export default function TabsLayout() {
  const { session } = useAuth();
  const { data: familyMember } = useCurrentFamilyMember(session?.user.id);

  // Se llama aca (y no en cada pantalla) porque este layout se queda
  // montado todo el tiempo que el usuario esta dentro de (tabs),
  // aunque cambie de tab — asi la suscripcion de Realtime vive una
  // sola vez, no se abre y cierra al saltar entre Misiones/Familia/etc.
  useRealtimeSync(familyMember?.family_id as string | undefined);

  return (
    // El card flotante va afuera de <Tabs> pero adentro de este
    // wrapper, asi queda montado una sola vez y visible arriba de
    // cualquier tab (usa position: absolute, ver MissionPenaltyCard).
    <View className="flex-1">
      <MissionPenaltyCard />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#F5B942",
          tabBarStyle: { backgroundColor: "#1B1F33", borderTopColor: "#0F1220" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Domio",
            tabBarIcon: ({ color }) => <Text style={{ color }}>🏠</Text>,
          }}
        />
        <Tabs.Screen
          name="missions"
          options={{
            title: "Misiones",
            tabBarIcon: ({ color }) => <Text style={{ color }}>🎯</Text>,
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: "Familia",
            tabBarIcon: ({ color }) => <Text style={{ color }}>👨‍👩‍👧</Text>,
          }}
        />
        <Tabs.Screen
          name="rewards"
          options={{
            title: "Recompensas",
            tabBarIcon: ({ color }) => <Text style={{ color }}>🎁</Text>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Perfil",
            tabBarIcon: ({ color }) => <Text style={{ color }}>🙂</Text>,
          }}
        />
      </Tabs>
    </View>
  );
}
