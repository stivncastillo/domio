import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const familySchema = z.object({
  familyName: z.string().min(2, "Ponele un nombre a tu Domio"),
});

type FamilyForm = z.infer<typeof familySchema>;

export default function CreateFamilyScreen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FamilyForm>({
    resolver: zodResolver(familySchema),
    defaultValues: { familyName: "" },
  });

  const onSubmit = async ({ familyName }: FamilyForm) => {
    // create_family (supabase/migrations/0002_onboarding.sql) crea, en
    // un solo paso atomico: la familia, tu fila en family_members como
    // admin, y el domio_progress inicial en nivel 1.
    const { error } = await supabase.rpc("create_family", { family_name: familyName });

    if (error) {
      setError("root", { message: error.message });
      return;
    }

    // Le avisamos a TanStack Query que el resultado de useCurrentFamilyMember
    // quedo desactualizado. app/_layout.tsx la vuelve a pedir, ve que ahora
    // SI hay family_members, y cambia solo de (onboarding) a (tabs).
    await queryClient.invalidateQueries({ queryKey: ["family-member", session?.user.id] });
  };

  // DEBUG TEMPORAL: llama a la funcion debug_whoami() (ver instrucciones
  // de Claude) para confirmar que rol/usuario ve Postgres en esta llamada.
  // Borrar este handler y el boton de abajo una vez resuelto el bug de RLS.
  const onDebugWhoAmI = async () => {
    const { data, error } = await supabase.rpc("debug_whoami");
    if (error) {
      Alert.alert("Error llamando debug_whoami", error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    Alert.alert("debug_whoami()", `uid: ${row?.uid ?? "null"}\nrole: ${row?.role ?? "null"}`);
  };

  return (
    <View className="flex-1 justify-center bg-domio-bg px-6">
      <Text className="mb-1 text-3xl font-bold text-white">Crea tu Domio</Text>
      <Text className="mb-8 text-domio-muted">
        Este va a ser el mundo compartido de tu familia.
      </Text>

      <Controller
        control={control}
        name="familyName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className="mb-2 rounded-xl bg-domio-card px-4 py-3 text-white"
            placeholder="Ej: Los Castillo"
            placeholderTextColor="#7A7F9A"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.familyName && (
        <Text className="mb-2 text-domio-danger">{errors.familyName.message}</Text>
      )}
      {errors.root && <Text className="mb-2 text-domio-danger">{errors.root.message}</Text>}

      <Pressable
        className="mt-4 items-center rounded-xl bg-domio-primary py-3"
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="font-semibold text-domio-bg">
          {isSubmitting ? "Creando..." : "Crear Domio"}
        </Text>
      </Pressable>

      {/* DEBUG TEMPORAL — borrar despues de diagnosticar el error de RLS */}
      <Pressable className="mt-4 items-center" onPress={onDebugWhoAmI}>
        <Text className="text-domio-secondary">🔍 Ver mi sesión (debug)</Text>
      </Pressable>

      {/*
        Util mientras desarrollamos/probamos: en este punto del flujo
        (sesion activa, sin familia todavia) no hay tabs ni pantalla de
        Perfil a la que ir, asi que sin esto quedarias sin forma de
        volver al login desde la UI.
      */}
      <Pressable className="mt-6 items-center" onPress={() => supabase.auth.signOut()}>
        <Text className="text-domio-muted">Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}
