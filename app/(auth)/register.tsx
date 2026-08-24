import { View, Text, TextInput, Pressable } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "expo-router";

import { supabase } from "@/lib/supabase";

const registerSchema = z
  .object({
    displayName: z.string().min(2, "Minimo 2 caracteres"),
    email: z.string().email("Ingresa un email valido"),
    password: z.string().min(6, "Minimo 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async ({ displayName, email, password }: RegisterForm) => {
    // `options.data` viaja como `raw_user_meta_data` en auth.users, y de
    // ahi lo toma el trigger `handle_new_user` (supabase/migrations/
    // 0002_onboarding.sql) para crear la fila en `profiles`.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });

    if (error) {
      setError("root", { message: error.message });
      return;
    }

    if (!data.session) {
      // Solo pasa si "Confirm email" sigue activado en tu proyecto de
      // Supabase (Authentication -> Providers -> Email). Ver README.
      setError("root", {
        message: "Cuenta creada. Revisa tu email para confirmar antes de entrar.",
      });
      return;
    }

    // Con sesion creada, useAuth + useCurrentFamilyMember en
    // app/_layout.tsx detectan el cambio y mandan al usuario a
    // (onboarding)/create-family automaticamente (todavia no tiene
    // family_members), sin necesidad de navegar manualmente aca.
  };

  return (
    <View className="flex-1 justify-center bg-domio-bg px-6">
      <Text className="mb-1 text-3xl font-bold text-white">Crear cuenta</Text>
      <Text className="mb-8 text-domio-muted">Unite a Domio.</Text>

      <Controller
        control={control}
        name="displayName"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className="mb-2 rounded-xl bg-domio-card px-4 py-3 text-white"
            placeholder="Tu nombre"
            placeholderTextColor="#7A7F9A"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.displayName && (
        <Text className="mb-2 text-domio-danger">{errors.displayName.message}</Text>
      )}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className="mb-2 rounded-xl bg-domio-card px-4 py-3 text-white"
            placeholder="Email"
            placeholderTextColor="#7A7F9A"
            autoCapitalize="none"
            keyboardType="email-address"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.email && <Text className="mb-2 text-domio-danger">{errors.email.message}</Text>}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className="mb-2 rounded-xl bg-domio-card px-4 py-3 text-white"
            placeholder="Contraseña"
            placeholderTextColor="#7A7F9A"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.password && (
        <Text className="mb-2 text-domio-danger">{errors.password.message}</Text>
      )}

      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            className="mb-2 rounded-xl bg-domio-card px-4 py-3 text-white"
            placeholder="Confirmar contraseña"
            placeholderTextColor="#7A7F9A"
            secureTextEntry
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.confirmPassword && (
        <Text className="mb-2 text-domio-danger">{errors.confirmPassword.message}</Text>
      )}
      {errors.root && <Text className="mb-2 text-domio-danger">{errors.root.message}</Text>}

      <Pressable
        className="mt-4 items-center rounded-xl bg-domio-primary py-3"
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="font-semibold text-domio-bg">
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </Text>
      </Pressable>

      <Link href="/(auth)/login" className="mt-6 text-center text-domio-secondary">
        ¿Ya tenes cuenta? Entra aca
      </Link>
    </View>
  );
}
