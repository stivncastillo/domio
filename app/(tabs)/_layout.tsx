import { Tabs } from "expo-router";
import { Text } from "react-native";

/**
 * Expo Router: cada archivo dentro de app/(tabs)/ es un tab automatico.
 * `tabBarIcon` normalmente usa @expo/vector-icons; por simplicidad
 * arrancamos con emojis como placeholder.
 */
export default function TabsLayout() {
  return (
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
        name="misiones"
        options={{
          title: "Misiones",
          tabBarIcon: ({ color }) => <Text style={{ color }}>🎯</Text>,
        }}
      />
      <Tabs.Screen
        name="familia"
        options={{
          title: "Familia",
          tabBarIcon: ({ color }) => <Text style={{ color }}>👨‍👩‍👧</Text>,
        }}
      />
      <Tabs.Screen
        name="recompensas"
        options={{
          title: "Recompensas",
          tabBarIcon: ({ color }) => <Text style={{ color }}>🎁</Text>,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <Text style={{ color }}>🙂</Text>,
        }}
      />
    </Tabs>
  );
}
