import { View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

interface ProgressBarProps {
  /** 0 a 1 */
  progress: number;
  colorClassName?: string;
}

/**
 * Reanimated corre las animaciones en el "UI thread" en vez del thread
 * de JS, asi que la barra no se traba aunque haya trabajo pesado
 * corriendo en JS (por ejemplo, refetch de queries). Por eso lo usamos
 * para feedback visual en vez de animar con setState + estilos.
 */
export function ProgressBar({ progress, colorClassName = "bg-domio-primary" }: ProgressBarProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: `${withTiming(Math.max(0, Math.min(1, progress)) * 100, { duration: 500 })}%`,
  }));

  return (
    <View className="h-3 w-full overflow-hidden rounded-full bg-black/20">
      <Animated.View className={`h-full rounded-full ${colorClassName}`} style={animatedStyle} />
    </View>
  );
}
