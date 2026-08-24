/**
 * Suscripcion a Supabase Realtime para que el progreso de Domio, las
 * misiones y el XP individual se actualicen solos en todos los
 * dispositivos conectados a la misma familia, sin depender de que
 * cada pantalla haga refetch manual.
 *
 * Como funciona por dentro: Postgres registra cada cambio en un
 * "write-ahead log" (WAL). Supabase Realtime lee ese log y lo
 * retransmite por WebSocket a quien este suscripto a un "channel". Por
 * eso hace falta habilitar la tabla en la publicacion
 * `supabase_realtime` primero (ver 0007_enable_realtime.sql) — sin
 * eso, ese cambio ni siquiera queda disponible para que Realtime lo
 * lea, por mas que te suscribas del lado del cliente.
 *
 * No usamos el `old`/`new` que trae cada evento (ej. para comparar el
 * XP antes/despues): con la configuracion default de Postgres
 * (`replica identity` = solo la primary key), el `old` de un UPDATE
 * viene incompleto — para tener el row completo de antes hay que
 * correr `alter table domio_progress replica identity full;`. Por
 * ahora nos alcanza con "algo cambio, volve a pedir los datos".
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useDomiStore } from "@/stores/useDomiStore";

export function useRealtimeSync(familyId: string | undefined) {
  const queryClient = useQueryClient();
  const celebrate = useDomiStore((state) => state.celebrate);
  const stopCelebrating = useDomiStore((state) => state.stopCelebrating);

  useEffect(() => {
    if (!familyId) return;

    // Un solo "channel" con tres suscripciones (una por tabla): abre
    // un solo WebSocket para las tres, en vez de tres conexiones
    // separadas. El nombre del channel es arbitrario, pero conviene
    // que sea unico por familia.
    const channel = supabase
      .channel(`family-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "domio_progress",
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["domio-progress", familyId] });
          // Hoy domio_progress solo sube (no hay logica que le reste
          // XP), asi que cualquier UPDATE es una buena excusa para que
          // Domi festeje un toque.
          celebrate();
          setTimeout(stopCelebrating, 1800);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "missions",
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["missions", familyId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "family_members",
          filter: `family_id=eq.${familyId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["family-members", familyId] });
        },
      )
      .subscribe();

    // Limpieza: si familyId cambia o el componente que llama a este
    // hook se desmonta, cerramos el channel — sino quedan
    // suscripciones colgadas cada vez que se remonta la pantalla.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, queryClient, celebrate, stopCelebrating]);
}
