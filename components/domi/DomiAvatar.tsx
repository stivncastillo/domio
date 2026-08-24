import { Text } from "react-native";
import { MotiView } from "moti";

import { useDomiStore, type DomiMood } from "@/stores/useDomiStore";

const MOOD_EMOJI: Record<DomiMood, string> = {
  feliz: "🐾✨",
  tranquilo: "🐾",
  alerta: "🐾⚠️",
  cansado: "🐾💤",
};

const MOOD_MESSAGE: Record<DomiMood, string> = {
  feliz: "¡Hoy vamos muy bien!",
  tranquilo: "Todo tranquilo por aca.",
  alerta: "Se estan acumulando misiones...",
  cansado: "Domi necesita una mano.",
};

/**
 * Placeholder de Domi. Moti es una capa encima de Reanimated con una
 * API declarativa tipo "from/animate/transition" — mas simple de leer
 * que useAnimatedStyle para animaciones sencillas como este "respirar".
 * Cuando haya ilustraciones reales, este componente reemplaza el emoji
 * por el sprite/Lottie correspondiente segun el mood.
 */
export function DomiAvatar() {
  const mood = useDomiStore((state) => state.mood);

  return (
    <MotiView
      from={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      transition={{ type: "timing", duration: 1200, loop: true, repeatReverse: true }}
      className="items-center"
    >
      <Text className="text-6xl">{MOOD_EMOJI[mood]}</Text>
      <Text className="mt-2 text-domio-muted">{MOOD_MESSAGE[mood]}</Text>
    </MotiView>
  );
}
