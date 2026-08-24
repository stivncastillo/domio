import { Text } from "react-native";
import { MotiView } from "moti";

import { useDomiStore, type DomiMood } from "@/stores/useDomiStore";

const MOOD_EMOJI: Record<DomiMood, string> = {
  happy: "🐾✨",
  calm: "🐾",
  alert: "🐾⚠️",
  tired: "🐾💤",
};

const MOOD_MESSAGE: Record<DomiMood, string> = {
  happy: "¡Hoy vamos muy bien!",
  calm: "Todo tranquilo por aca.",
  alert: "Se estan acumulando misiones...",
  tired: "Domi necesita una mano.",
};

/**
 * Placeholder de Domi. Moti es una capa encima de Reanimated con una
 * API declarativa tipo "from/animate/transition" — mas simple de leer
 * que useAnimatedStyle para animaciones sencillas como este "respirar".
 * Cuando haya ilustraciones reales, este componente reemplaza el emoji
 * por el sprite/Lottie correspondiente segun el mood.
 *
 * `isCelebrating` lo dispara hooks/useRealtimeSync.ts cuando llega un
 * cambio de XP del Domio por Realtime (de este dispositivo o de otro
 * integrante) — por eso Domi puede "reaccionar" sin que vos hagas nada.
 */
export function DomiAvatar() {
  const mood = useDomiStore((state) => state.mood);
  const isCelebrating = useDomiStore((state) => state.isCelebrating);

  return (
    <MotiView
      from={{ scale: 0.95 }}
      animate={{ scale: isCelebrating ? 1.15 : 1 }}
      transition={
        isCelebrating
          ? { type: "spring", damping: 6 }
          : { type: "timing", duration: 1200, loop: true, repeatReverse: true }
      }
      className="items-center"
    >
      <Text className="text-6xl">{isCelebrating ? "🎉" : MOOD_EMOJI[mood]}</Text>
      <Text className="mt-2 text-domio-muted">
        {isCelebrating ? "¡Domi sumó XP recién!" : MOOD_MESSAGE[mood]}
      </Text>
    </MotiView>
  );
}
