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
 * (Excepcion: mission_penalties abajo SI lee `payload.new` — es un
 * INSERT, no un UPDATE, y en un INSERT la fila nueva siempre viene
 * completa sin importar la configuracion de replica identity.)
 *
 * ============================================================
 * Vencimiento de misiones (0015_mission_deadlines_and_penalties.sql)
 * ============================================================
 * Se decidio con Stiven (via AskUserQuestion) chequear misiones
 * obligatorias vencidas "bajo demanda" en vez de un cron de Supabase:
 * cada vez que este hook se monta (osea, cada vez que alguien de la
 * familia entra a (tabs)), se llama a la RPC `process_overdue_missions`.
 * Si encuentra alguna, la marca 'failed', resta el XP configurado al
 * Domio, e inserta una fila en `mission_penalties` — ese INSERT es lo
 * que dispara la suscripcion de abajo (en TODOS los dispositivos
 * conectados a esa familia, incluido el que disparo la RPC) y muestra
 * el card por unos minutos via useDomiStore.showMissionPenalty.
 *
 * La llamada a la RPC se hace recien cuando el channel confirma
 * `SUBSCRIBED` (no apenas se llama a `.subscribe()`) para evitar una
 * condicion de carrera: si la RPC insertara en mission_penalties ANTES
 * de que la suscripcion este lista, ese INSERT se perderia y el card
 * nunca aparecería para quien disparo el chequeo.
 *
 * ============================================================
 * Racha familiar (0016_family_streak.sql)
 * ============================================================
 * Mismo criterio "bajo demanda" que arriba: `recompute_family_streak`
 * se llama tambien en el mismo callback `SUBSCRIBED`, y ADEMAS justo
 * despues de completar una mision (hooks/useMissions.ts,
 * useCompleteMission) para que la racha suba al toque ese mismo dia.
 * La funcion no incrementa un contador — recalcula la racha completa
 * desde el historial de `mission_completions` cada vez, asi que
 * llamarla desde dos lugares distintos no duplica nada. El UPDATE que
 * hace sobre `domio_progress` ya dispara la suscripcion de arriba
 * (domio_progress esta en Realtime desde 0007), asi que no hizo falta
 * agregar una suscripcion nueva para esto.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useDomiStore } from "@/stores/useDomiStore";

// Cuanto tiempo queda visible el card de "misión no cumplida" antes de
// esconderse solo — Stiven pidio "unos minutos", 5 es un punto medio
// razonable (ni parpadea, ni se queda pegado toda la sesión).
const MISSION_PENALTY_VISIBLE_MS = 5 * 60 * 1000;

export function useRealtimeSync(familyId: string | undefined) {
  const queryClient = useQueryClient();
  const celebrate = useDomiStore((state) => state.celebrate);
  const stopCelebrating = useDomiStore((state) => state.stopCelebrating);
  const showMissionPenalty = useDomiStore((state) => state.showMissionPenalty);
  const dismissMissionPenalty = useDomiStore((state) => state.dismissMissionPenalty);

  useEffect(() => {
    if (!familyId) return;

    // Un solo "channel" con las suscripciones (una por tabla): abre un
    // solo WebSocket para todas, en vez de una conexion por tabla. El
    // nombre del channel es arbitrario, pero conviene que sea unico
    // por familia.
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
          // "EQUIPO DOMIO" en el Home (hooks/useFamily.ts,
          // useWeeklyContributions): cada vez que alguien completa una
          // mision, domio_progress se actualiza — piggybackeamos en
          // ese mismo evento para refrescar el aporte semanal de cada
          // integrante en TODOS los dispositivos conectados, sin
          // agregar una suscripcion nueva (mismo criterio que la racha
          // familiar en 0016_family_streak.sql).
          queryClient.invalidateQueries({ queryKey: ["weekly-contributions", familyId] });
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mission_penalties",
          filter: `family_id=eq.${familyId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            mission_title: string;
            xp_lost: number;
          };
          queryClient.invalidateQueries({ queryKey: ["missions", familyId] });
          queryClient.invalidateQueries({ queryKey: ["domio-progress", familyId] });
          showMissionPenalty({ id: row.id, missionTitle: row.mission_title, xpLost: row.xp_lost });
          setTimeout(() => dismissMissionPenalty(row.id), MISSION_PENALTY_VISIBLE_MS);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          supabase.rpc("process_overdue_missions", { target_family_id: familyId }).then(({ error }) => {
            if (error) {
              // No es critico (el proximo montaje del hook lo vuelve a
              // intentar) — solo se loguea, no hace falta molestar al
              // usuario con un Alert por esto.
              console.warn("No se pudieron chequear misiones vencidas:", error.message);
            }
          });
          // Racha familiar (0016_family_streak.sql): se recalcula acá
          // tambien (ademas de en useCompleteMission) para cubrir el
          // caso de que la racha se haya cortado mientras nadie tenia
          // la app abierta — sin esto, un dia sin actividad podria
          // quedar mostrando la racha vieja hasta la proxima mision
          // completada.
          supabase.rpc("recompute_family_streak", { target_family_id: familyId }).then(({ error }) => {
            if (error) {
              console.warn("No se pudo recalcular la racha familiar:", error.message);
            }
          });
        }
      });

    // Limpieza: si familyId cambia o el componente que llama a este
    // hook se desmonta, cerramos el channel — sino quedan
    // suscripciones colgadas cada vez que se remonta la pantalla.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    familyId,
    queryClient,
    celebrate,
    stopCelebrating,
    showMissionPenalty,
    dismissMissionPenalty,
  ]);
}
