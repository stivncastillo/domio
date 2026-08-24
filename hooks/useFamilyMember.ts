/**
 * ¿El usuario logueado ya pertenece a una familia (ya tiene un Domio)?
 * app/_layout.tsx usa esto, junto con useAuth, para decidir entre 3
 * estados de navegacion: sin sesion -> (auth); con sesion pero sin
 * familia -> (onboarding)/crear-familia; con sesion y familia -> (tabs).
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export function useCurrentFamilyMember(userId: string | undefined) {
  return useQuery({
    queryKey: ["family-member", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("id, family_id, role")
        .eq("profile_id", userId as string)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
