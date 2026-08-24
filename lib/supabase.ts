/**
 * Cliente de Supabase para la app.
 *
 * Por que expo-sqlite/localStorage y no AsyncStorage puro:
 * Supabase necesita guardar la sesion (access/refresh token) en el
 * dispositivo para que el usuario no tenga que loguearse cada vez que
 * abre la app. expo-sqlite expone una implementacion de `localStorage`
 * respaldada por SQLite, que es mas robusta que AsyncStorage para esto
 * (evita corrupciones si la app se cierra a mitad de una escritura).
 */
import "expo-sqlite/localStorage/install";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

// Nota: todavia no generamos los tipos reales desde el schema de
// Supabase (ver README, seccion "Generar tipos"). Hasta que eso este
// hecho, dejamos el cliente sin el generic <Database> — parametrizarlo
// con un tipo placeholder puede romper la inferencia de `.from(...)`
// de formas dificiles de diagnosticar sin los tipos reales instalados.
// Cuando corras `npx supabase gen types ...`, volve a agregar
// `createClient<Database>(...)` usando el tipo generado.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copia .env.example a .env y completa los valores de tu proyecto Supabase.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Supabase refresca el token de sesion en un loop continuo. En movil
 * conviene pausarlo cuando la app pasa a background para no gastar
 * bateria/red innecesariamente, y reanudarlo al volver a foreground.
 */
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
