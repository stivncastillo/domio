import { View, Text, TextInput, Pressable } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "expo-router";

import { supabase } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().email("Ingresa un email valido"),
  password: z.string().min(6, "Minimo 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginForm) => {
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setError("root", { message: error.message });
    }
    // Si el login es exitoso, useAuth detecta la sesion y app/_layout.tsx
    // redirige automaticamente a (tabs).
  };

  return (
    <View className="flex-1 justify-center bg-domio-bg px-6">
      <Text className="mb-1 text-3xl font-bold text-white">Domio</Text>
      <Text className="mb-8 text-domio-muted">Tu familia. Tu mundo. Tus misiones.</Text>

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
      {errors.password && <Text className="mb-2 text-domio-danger">{errors.password.message}</Text>}
      {errors.root && <Text className="mb-2 text-domio-danger">{errors.root.message}</Text>}

      <Pressable
        className="mt-4 items-center rounded-xl bg-domio-primary py-3"
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="font-semibold text-domio-bg">
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Text>
      </Pressable>

      <Link href="/(auth)/register">
        <Text className="mt-6 text-center text-domio-secondary">¿No tenes cuenta? Creala aca</Text>
      </Link>
    </View>
  );
}
