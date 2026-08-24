import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card } from "@/components/ui/Card";
import { MissionRow } from "@/components/ui/MissionRow";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useMisiones, useCreateMision, useCompleteMision } from "@/hooks/useMissions";

const missionSchema = z.object({
  title: z.string().min(2, "Ponele un titulo"),
  xpReward: z.coerce.number().int().min(1, "Minimo 1 XP").max(200, "Maximo 200 XP"),
  type: z.enum(["unica", "familiar"]),
  isMandatory: z.boolean(),
});

type MissionForm = z.infer<typeof missionSchema>;

export default function MisionesScreen() {
  const [showForm, setShowForm] = useState(false);
  const { session } = useAuth();
  const { data: familyMember } = useCurrentFamilyMember(session?.user.id);
  const familyId = familyMember?.family_id as string | undefined;

  const { data: missions, isLoading } = useMisiones(familyId);
  const createMision = useCreateMision();
  const completeMision = useCompleteMision(familyId, session?.user.id);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MissionForm>({
    resolver: zodResolver(missionSchema),
    defaultValues: { title: "", xpReward: 10, type: "unica", isMandatory: false },
  });

  const onSubmit = async (values: MissionForm) => {
    if (!familyId || !session) return;
    await createMision.mutateAsync({
      familyId,
      createdBy: session.user.id,
      title: values.title,
      type: values.type,
      isMandatory: values.isMandatory,
      xpReward: values.xpReward,
    });
    reset();
    setShowForm(false);
  };

  return (
    <View className="flex-1 bg-domio-bg px-4 pt-16">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-white">Misiones</Text>
        <Pressable
          className="rounded-full bg-domio-primary px-4 py-2"
          onPress={() => setShowForm((prev) => !prev)}
        >
          <Text className="font-semibold text-domio-bg">{showForm ? "Cancelar" : "+ Nueva"}</Text>
        </Pressable>
      </View>

      {showForm && (
        <Card className="mb-4">
          <Controller
            control={control}
            name="title"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="mb-2 rounded-xl bg-domio-bg px-4 py-3 text-white"
                placeholder="Titulo (ej: Sacar la basura)"
                placeholderTextColor="#7A7F9A"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
              />
            )}
          />
          {errors.title && <Text className="mb-2 text-domio-danger">{errors.title.message}</Text>}

          <Controller
            control={control}
            name="xpReward"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="mb-2 rounded-xl bg-domio-bg px-4 py-3 text-white"
                placeholder="XP (ej: 10)"
                placeholderTextColor="#7A7F9A"
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={String(value)}
              />
            )}
          />
          {errors.xpReward && (
            <Text className="mb-2 text-domio-danger">{errors.xpReward.message}</Text>
          )}

          {/*
            "Familiar" = "cualquiera la completa" (fase 1): el XP entero
            va al Domio, no al individuo que la marco. Mas adelante,
            cuando exista la version colaborativa con subtareas por
            integrante, esto se va a separar en un tipo de mision
            distinto.
          */}
          <Controller
            control={control}
            name="type"
            render={({ field: { onChange, value } }) => (
              <View className="mb-2 flex-row gap-2">
                <Pressable
                  className={`flex-1 items-center rounded-xl py-2 ${
                    value === "unica" ? "bg-domio-primary" : "bg-domio-bg"
                  }`}
                  onPress={() => onChange("unica")}
                >
                  <Text className={value === "unica" ? "text-domio-bg" : "text-white"}>
                    Única
                  </Text>
                </Pressable>
                <Pressable
                  className={`flex-1 items-center rounded-xl py-2 ${
                    value === "familiar" ? "bg-domio-primary" : "bg-domio-bg"
                  }`}
                  onPress={() => onChange("familiar")}
                >
                  <Text className={value === "familiar" ? "text-domio-bg" : "text-white"}>
                    Familiar
                  </Text>
                </Pressable>
              </View>
            )}
          />

          <Controller
            control={control}
            name="isMandatory"
            render={({ field: { onChange, value } }) => (
              <Pressable
                className="mb-2 flex-row items-center gap-2"
                onPress={() => onChange(!value)}
              >
                <View
                  className={`h-5 w-5 rounded border ${
                    value ? "border-domio-primary bg-domio-primary" : "border-domio-muted"
                  }`}
                />
                <Text className="text-white">Obligatoria (resta XP si no se cumple)</Text>
              </Pressable>
            )}
          />

          <Pressable
            className="mt-2 items-center rounded-xl bg-domio-primary py-3"
            disabled={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          >
            <Text className="font-semibold text-domio-bg">
              {isSubmitting ? "Creando..." : "Crear misión"}
            </Text>
          </Pressable>
        </Card>
      )}

      {isLoading ? (
        <ActivityIndicator color="#F5B942" />
      ) : (
        <FlatList
          data={missions ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-domio-muted">
              Todavia no hay misiones. Creá la primera con "+ Nueva".
            </Text>
          }
          renderItem={({ item }) => (
            <MissionRow
              mission={item}
              onToggle={
                item.status === "pendiente" ? () => completeMision.mutate(item.id) : undefined
              }
            />
          )}
        />
      )}
    </View>
  );
}
