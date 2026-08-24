import { View, Text, TextInput, Pressable } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const joinSchema = z.object({
  inviteCode: z.string().trim().min(4, "El código es muy corto"),
});

type JoinForm = z.infer<typeof joinSchema>;

export default function JoinFamilyScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<JoinForm>({
    resolver: zodResolver(joinSchema),
    defaultValues: { inviteCode: "" },
  });

  const onSubmit = async ({ inviteCode }: JoinForm) => {
    // join_family (supabase/migrations/0006_invite_members.sql) valida
    // el codigo y te agrega como member de esa familia en un solo paso.
    const { error } = await supabase.rpc("join_family", {
      target_invite_code: inviteCode,
    });

    if (error) {
      setError("root", { message: error.message });
      return;
    }

    // Mismo patron que crear-familia: invalidamos la query de
    // useCurrentFamilyMember y app/_layout.tsx te manda solo a (tabs).
    await queryClient.invalidateQueries({ queryKey: ["family-member", session?.user.id] });
  };

  return (
    <View className="flex-1 justify-center bg-domio-bg px-6">
      <Text className="mb-1 text-3xl font-bold text-white">Unite a un Domio</Text>
      <Text className="mb-8 text-domio-muted">
        Pedile el código de invitación a alguien de tu familia.
      </Text>

      <Controller
        control={control}
        name="inviteCode"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className="mb-2 rounded-xl bg-domio-card px-4 py-3 text-white"
            placeholder="Ej: a1b2c3d4"
            placeholderTextColor="#7A7F9A"
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.inviteCode && (
        <Text className="mb-2 text-domio-danger">{errors.inviteCode.message}</Text>
      )}
      {errors.root && <Text className="mb-2 text-domio-danger">{errors.root.message}</Text>}

      <Pressable
        className="mt-4 items-center rounded-xl bg-domio-primary py-3"
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="font-semibold text-domio-bg">
          {isSubmitting ? "Uniéndome..." : "Unirme"}
        </Text>
      </Pressable>

      <Link href="/(onboarding)/create-family" className="mt-6 text-center text-domio-secondary">
        ¿Preferís crear tu propio Domio?
      </Link>

      <Pressable className="mt-6 items-center" onPress={() => supabase.auth.signOut()}>
        <Text className="text-domio-muted">Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}
