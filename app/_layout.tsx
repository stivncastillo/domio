// Entry point de la navegacion (Expo Router: cada archivo en app/ es una ruta).
import "../global.css";

import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";

/**
 * Separado del RootLayout porque useCurrentFamilyMember usa
 * useQuery, que necesita estar DEBAJO de QueryClientProvider en el
 * arbol — por eso QueryClientProvider envuelve a este componente
 * en vez de vivir adentro de el.
 */
function RootNavigator() {
  const { session, isLoading: isAuthLoading } = useAuth();
  const { data: familyMember, isLoading: isFamilyLoading } = useCurrentFamilyMember(
    session?.user.id,
  );

  // Mientras no sabemos si hay sesion, o (habiendo sesion) mientras no
  // sabemos todavia si esa persona ya tiene familia, no mostramos nada
  // — evita un parpadeo mostrando la pantalla equivocada un instante.
  const isStillResolving = isAuthLoading || (!!session && isFamilyLoading);
  if (isStillResolving) {
    // TODO: reemplazar por una splash/loading screen con Domi.
    return null;
  }

  const isAuthenticated = !!session;
  const hasFamily = !!familyMember;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/*
        Stack.Protected: 3 estados posibles de navegacion segun sesion
        + pertenencia a una familia. Expo Router se encarga solo de
        navegar al grupo correcto (y de re-navegar si el estado
        cambia, ej. justo despues de crear la familia).
      */}
      <Stack.Protected guard={isAuthenticated && hasFamily}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && !hasFamily}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
