import { Pressable, Text } from "react-native";
import { MotiView } from "moti";

import { useDomiStore } from "@/stores/useDomiStore";

/**
 * Card flotante que avisa "esta misión no se cumplió a tiempo, el
 * Domio perdió X XP". Lo dispara hooks/useRealtimeSync.ts cuando llega
 * un INSERT en mission_penalties (0015_mission_deadlines_and_penalties.sql)
 * — se muestra una vez (mientras exista `missionPenalty` en
 * useDomiStore) y se esconde solo a los pocos minutos (ese timer vive
 * en useRealtimeSync, no aca). El botón "✕" lo cierra antes si
 * alguien lo quiere sacar de encima.
 *
 * Se monta una sola vez en app/(tabs)/_layout.tsx (no en cada
 * pantalla) para que quede visible sin importar en que tab estés —
 * mismo criterio que DomiAvatar reaccionando a Realtime.
 */
export function MissionPenaltyCard() {
  const missionPenalty = useDomiStore((state) => state.missionPenalty);
  const dismissMissionPenalty = useDomiStore((state) => state.dismissMissionPenalty);

  if (!missionPenalty) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: -12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 250 }}
      className="absolute left-4 right-4 top-14 z-50 flex-row items-center justify-between rounded-2xl border border-domio-danger bg-domio-card px-4 py-3"
    >
      <Text className="flex-1 pr-2 text-sm text-white">
        <Text className="font-semibold text-domio-danger">❌ No se cumplió a tiempo: </Text>
        {missionPenalty.missionTitle} — el Domio perdió {missionPenalty.xpLost} XP.
      </Text>
      <Pressable
        onPress={() => dismissMissionPenalty(missionPenalty.id)}
        hitSlop={8}
        className="ml-2 rounded-full bg-domio-bg px-2 py-1"
      >
        <Text className="text-domio-muted">✕</Text>
      </Pressable>
    </MotiView>
  );
}
