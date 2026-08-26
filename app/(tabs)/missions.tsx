import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, Alert } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Card } from "@/components/ui/Card";
import { MissionRow } from "@/components/ui/MissionRow";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentFamilyMember } from "@/hooks/useFamilyMember";
import { useFamilyMembers } from "@/hooks/useFamily";
import { useMissions, useCreateMission, useCompleteMission } from "@/hooks/useMissions";

const missionSchema = z
  .object({
    title: z.string().min(2, "Ponele un titulo"),
    xpReward: z.coerce.number().int().min(1, "Minimo 1 XP").max(200, "Maximo 200 XP"),
    // Las coins se pagan en cualquier tipo de mision (ver complete_mission,
    // 0011_family_mission_coins.sql): en "single" van al asignado, en
    // "family" van a quien la completa. 0 es un valor valido, una mision
    // puede dar solo XP y nada de moneda.
    coinReward: z.coerce.number().int().min(0, "No puede ser negativo").max(200, "Maximo 200"),
    type: z.enum(["single", "family"]),
    isMandatory: z.boolean(),
    assigneeId: z.string().optional(),
  })
  // Una mision "single" necesita saber quien la tiene que hacer — una
  // "family" no, porque cualquiera la puede completar.
  .refine((values) => values.type !== "single" || !!values.assigneeId, {
    message: "Elegí a quién se la asignás",
    path: ["assigneeId"],
  });

type MissionForm = z.infer<typeof missionSchema>;

export default function MissionsScreen() {
  const [showForm, setShowForm] = useState(false);
  const { session } = useAuth();
  const { data: familyMember } = useCurrentFamilyMember(session?.user.id);
  const familyId = familyMember?.family_id as string | undefined;
  // Crear/asignar misiones es cosa del admin (ver 0008_mission_roles_and_assignment.sql):
  // si un miembro cualquiera pudiera crearlas, podria inventarse una de
  // mucho XP y auto-completarla sin supervision.
  const isAdmin = familyMember?.role === "admin";

  const { data: missions, isLoading } = useMissions(familyId);
  const { data: familyMembers } = useFamilyMembers(familyId);
  const createMission = useCreateMission();
  const completeMission = useCompleteMission(familyId, session?.user.id);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MissionForm>({
    resolver: zodResolver(missionSchema),
    defaultValues: {
      title: "",
      xpReward: 10,
      coinReward: 5,
      type: "single",
      isMandatory: false,
      assigneeId: "",
    },
  });

  const type = watch("type");

  const onSubmit = async (values: MissionForm) => {
    if (!familyId || !session) return;
    try {
      await createMission.mutateAsync({
        familyId,
        title: values.title,
        type: values.type,
        isMandatory: values.isMandatory,
        xpReward: values.xpReward,
        coinReward: values.coinReward,
        assigneeFamilyMemberId: values.type === "single" ? values.assigneeId : undefined,
      });
    } catch (err: any) {
      Alert.alert("No se pudo crear la misión", err?.message ?? "Intenta de nuevo");
      return;
    }
    reset();
    setShowForm(false);
  };

  return (
    <View className="flex-1 bg-domio-bg px-4 pt-16">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-white">Misiones</Text>
        {isAdmin && (
          <Pressable
            className="rounded-full bg-domio-primary px-4 py-2"
            onPress={() => setShowForm((prev) => !prev)}
          >
            <Text className="font-semibold text-domio-bg">{showForm ? "Cancelar" : "+ Nueva"}</Text>
          </Pressable>
        )}
      </View>

      {!isAdmin && (
        <Text className="mb-4 text-domio-muted">
          Las misiones las crea y asigna el admin de la familia.
        </Text>
      )}

      {isAdmin && showForm && (
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

          <Controller
            control={control}
            name="coinReward"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className="mb-2 rounded-xl bg-domio-bg px-4 py-3 text-white"
                placeholder="Monedas (ej: 5, se gastan en recompensas)"
                placeholderTextColor="#7A7F9A"
                keyboardType="numeric"
                onBlur={onBlur}
                onChangeText={onChange}
                value={String(value)}
              />
            )}
          />
          {errors.coinReward && (
            <Text className="mb-2 text-domio-danger">{errors.coinReward.message}</Text>
          )}

          {/*
            "family" = "cualquiera la completa" (fase 1): el XP entero
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
                    value === "single" ? "bg-domio-primary" : "bg-domio-bg"
                  }`}
                  onPress={() => onChange("single")}
                >
                  <Text className={value === "single" ? "text-domio-bg" : "text-white"}>
                    Única
                  </Text>
                </Pressable>
                <Pressable
                  className={`flex-1 items-center rounded-xl py-2 ${
                    value === "family" ? "bg-domio-primary" : "bg-domio-bg"
                  }`}
                  onPress={() => onChange("family")}
                >
                  <Text className={value === "family" ? "text-domio-bg" : "text-white"}>
                    Familiar
                  </Text>
                </Pressable>
              </View>
            )}
          />

          {type === "single" && (
            <>
              <Text className="mb-2 text-domio-muted">Asignar a</Text>
              <Controller
                control={control}
                name="assigneeId"
                render={({ field: { onChange, value } }) => (
                  <View className="mb-2 flex-row flex-wrap gap-2">
                    {(familyMembers ?? []).map((member) => (
                      <Pressable
                        key={member.id}
                        className={`rounded-xl px-3 py-2 ${
                          value === member.id ? "bg-domio-primary" : "bg-domio-bg"
                        }`}
                        onPress={() => onChange(member.id)}
                      >
                        <Text className={value === member.id ? "text-domio-bg" : "text-white"}>
                          {member.displayName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              />
              {errors.assigneeId && (
                <Text className="mb-2 text-domio-danger">{errors.assigneeId.message}</Text>
              )}
            </>
          )}

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
              {isAdmin
                ? 'Todavia no hay misiones. Creá la primera con "+ Nueva".'
                : "Todavia no tenés misiones asignadas."}
            </Text>
          }
          renderItem={({ item }) => (
            <MissionRow
              mission={item}
              onToggle={
                item.status === "pending" ? () => completeMission.mutate(item.id) : undefined
              }
            />
          )}
        />
      )}
    </View>
  );
}
