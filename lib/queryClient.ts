/**
 * TanStack Query = cache de datos del servidor (misiones, familia, XP...).
 *
 * Por que no basta con useState/useEffect + fetch:
 * Query nos da, gratis, cosas que en una app "viva" como Domio vamos a
 * necesitar todo el tiempo: refetch automatico al volver a foreground,
 * cache compartida entre pantallas (el dashboard y la tab de Misiones
 * muestran los mismos datos sin pedirlos dos veces), estados de
 * loading/error consistentes, y reintentos ante fallos de red.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s: los datos de misiones cambian seguido
      retry: 2,
    },
  },
});
