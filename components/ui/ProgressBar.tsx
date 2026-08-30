import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

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
 *
 * Bug real (2026-08-29, Stiven reporto "el progress de xp del domio
 * visualmente no se ve"): la version anterior armaba el estilo asi:
 *   width: `${withTiming(pct, { duration: 500 })}%`
 * Eso NO funciona en Reanimated: `withTiming(...)` no devuelve un
 * numero, devuelve un descriptor de animacion que Reanimated reconoce
 * SOLO cuando se lo asigna directo a una propiedad del objeto de
 * estilo (ej. `width: withTiming(120)` con un numero de pixeles). Al
 * meterlo adentro de un template string, JS lo convierte a texto antes
 * de que Reanimated pueda hacer nada con el ("[object Object]%"), asi
 * que el `width` terminaba siendo un valor invalido — la barra
 * quedaba con ancho 0 (invisible), tanto la de XP del Domio como la de
 * "Reto familiar" (las dos usan este mismo componente).
 *
 * Fix: un `useSharedValue` numerico (0-100) que se anima con
 * `withTiming` en un `useEffect` cuando cambia `progress`, y el estilo
 * arma el string `${pct.value}%` LEYENDO el shared value adentro del
 * worklet de `useAnimatedStyle` — ahi si es valido interpolar a
 * string, porque lo que se interpola es un numero plano (el valor
 * actual de la animacion en cada frame), no el descriptor de
 * `withTiming` en si.
 */
export function ProgressBar({ progress, colorClassName = "bg-domio-primary" }: ProgressBarProps) {
  const pct = useSharedValue(0);

  useEffect(() => {
    pct.value = withTiming(Math.max(0, Math.min(1, progress)) * 100, { duration: 500 });
  }, [progress, pct]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${pct.value}%`,
  }));

  return (
    <View className="h-3 w-full overflow-hidden rounded-full bg-black/20">
      <Animated.View className={`h-full rounded-full ${colorClassName}`} style={animatedStyle} />
    </View>
  );
}
