import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { DomioProgress } from "@/types/domain";

export function useDomioProgress(familyId: string | undefined) {
  return useQuery({
    queryKey: ["domio-progress", familyId],
    queryFn: async (): Promise<DomioProgress | null> => {
      const { data, error } = await supabase
        .from("domio_progress")
        .select("level, current_xp, xp_to_next_level, family_streak_days, mood")
        .eq("family_id", familyId as string)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        familyId: familyId as string,
        level: data.level,
        currentXp: data.current_xp,
        xpToNextLevel: data.xp_to_next_level,
        familyStreakDays: data.family_streak_days,
        mood: data.mood,
      };
    },
    enabled: !!familyId,
  });
}
