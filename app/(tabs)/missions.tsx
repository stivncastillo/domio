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
import {
  MISSION_COMPLEXITY_LABELS,
  MISSION_COMPLEXITY_REWARDS,
  type MissionComplexity,
} from "@/types/domain";

// Orden fijo para los chips de complejidad (Baja -> Media -> Alta),
// mas facil de leer que el orden alfabetico del enum de Postgres.
const COMPLEXITY_OPTIONS: MissionComplexity[] = ["low", "medium", "high"];

// Formato simple de texto para fecha/hora en vez de un date picker
// nativo: agregar uno (ej. @react-native-community/datetimepicker) es
// una dependencia nueva que requiere reconstruir el dev client, y este
// entorno no tiene acceso al registry de npm para instalarla y
// probarla (ver stack.md). Dos inputs de texto validados con regex
// evitan esa dependencia por ahora — se puede reemplazar por un picker
// nativo mas adelante sin tocar el resto del flujo.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const missionSchema = z
  .object({
    title: z.string().min(2, "Ponele un titulo"),
    // Complejidad (0017_mission_complexity.sql): reemplaza los campos
    // sueltos de XP/coins — el admin ya no los escribe a mano, el
    // valor sale de una tabla fija del lado de la base segun esto.
    complexity: z.enum(["low", "medium", "high"]),
    type: z.enum(["single", "family"]),
    isMandatory: z.boolean(),
    assigneeId: z.string().optional(),
    // Vencimiento (0015_mission_deadlines_and_penalties.sql): solo se
    // piden/usan cuando isMandatory es true — el constraint del lado
    // de la base exige fecha (el XP a restar ya no se pide: desde
    // 0017 sale de `complexity`, igual que el XP que se gana).
    dueDate: z.string().optional(),
    dueTime: z.string().optional(),
  })
  // Una mision "single" necesita saber quien la tiene que hacer — una
  // "family" no, porque cualquiera la puede completar.
  .refine((values) => values.type !== "single" || !!values.assigneeId, {
    message: "Elegí a quién se la asignás",
    path: ["assigneeId"],
  })
  .refine((values) => !values.isMandatory || DATE_RE.test(values.dueDate ?? ""), {
    message: "Fecha inválida (formato AAAA-MM-DD)",
    path: ["dueDate"],
  })
  .refine((values) => !values.isMandatory || TIME_RE.test(values.dueTime ?? ""), {
    message: "Hora inválida (formato HH:MM, 24hs)",
    path: ["dueTime"],
  })
  .refine(
    (values) => {
      if (!values.isMandatory) return true;
      if (!DATE_RE.test(values.dueDate ?? "") || !TIME_RE.test(values.dueTime ?? "")) return true; // ya lo marcan los refine de arriba
      const combined = new Date(`${values.dueDate}T${values.dueTime}:00`);
      return combined.getTime() > Date.now();
    },
    { message: "La fecha de vencimiento tiene que ser en el futuro", path: ["dueDate"] },
  );

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

  // Bug real (2026-08-30): el admin ve TODAS las misiones de su
  // familia (RLS de SELECT, 0008_mission_roles_and_assignment.sql —
  // necesario para poder gestionarlas), pero eso no significa que
  // pueda completar cualquiera — solo la puede completar quien esta
  // asignado (o cualquiera si es "family"). Mismo criterio que valida
  // 0018_complete_mission_assignee_check.sql del lado de la base;
  // esto es solo para la UI (no mostrar el tap como si funcionara).
  const canCompleteMission = (mission: { type: string; assignedTo: string[] }) =>
    mission.type === "family" ||
    mission.assignedTo.length === 0 || // mision vieja sin asignar: solo el admin llega a verla
    (!!familyMember?.id && mission.assignedTo.includes(familyMember.id));

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
      complexity: "medium",
      type: "single",
      isMandatory: false,
      assigneeId: "",
      dueDate: "",
      dueTime: "",
    },
  });

  const type = watch("type");
  const isMandatory = watch("isMandatory");
  const complexity = watch("complexity");

  const onSubmit = async (values: MissionForm) => {
    if (!familyId || !session) return;
    // Combina fecha + hora en un solo timestamp ISO recien aca (no en
    // el schema de zod) — mas simple mantener dueDate/dueTime como
    // strings sueltos mientras se tipea en el form.
    const dueAt = values.isMandatory
      ? new Date(`${values.dueDate}T${values.dueTime}:00`).toISOString()
      : undefined;
    try {
      await createMission.mutateAsync({
        familyId,
        title: values.title,
        type: values.type,
        isMandatory: values.isMandatory,
        complexity: values.complexity,
        assigneeFamilyMemberId: values.type === "single" ? values.assigneeId : undefined,
        dueAt,
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

          {/*
            Complejidad (0017_mission_complexity.sql): reemplaza los
            inputs sueltos de XP/coins que tenia el form antes. El
            admin elige Baja/Media/Alta y el XP/coins salen de una
            tabla fija del lado de la base (mismos valores que
            MISSION_COMPLEXITY_REWARDS, solo para el preview de aca).
          */}
          <Text className="mb-2 text-domio-muted">Complejidad</Text>
          <Controller
            control={control}
            name="complexity"
            render={({ field: { onChange, value } }) => (
              <View className="mb-1 flex-row gap-2">
                {COMPLEXITY_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    className={`flex-1 items-center rounded-xl py-2 ${
                      value === option ? "bg-domio-primary" : "bg-domio-bg"
                    }`}
                    onPress={() => onChange(option)}
                  >
                    <Text className={value === option ? "text-domio-bg" : "text-white"}>
                      {MISSION_COMPLEXITY_LABELS[option]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
          <Text className="mb-2 text-xs text-domio-muted">
            Da +{MISSION_COMPLEXITY_REWARDS[complexity].xp} XP y +
            {MISSION_COMPLEXITY_REWARDS[complexity].coins} 🪙 al completarla
          </Text>

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
                  <Text className={value === "single" ? "text-domio-bg" : "text-white"}>Única</Text>
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

          {isMandatory && (
            <>
              <Text className="mb-2 text-domio-muted">Vence el</Text>
              <View className="mb-1 flex-row gap-2">
                <Controller
                  control={control}
                  name="dueDate"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="flex-1 rounded-xl bg-domio-bg px-4 py-3 text-white"
                      placeholder="AAAA-MM-DD"
                      placeholderTextColor="#7A7F9A"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="dueTime"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="w-24 rounded-xl bg-domio-bg px-4 py-3 text-white"
                      placeholder="HH:MM"
                      placeholderTextColor="#7A7F9A"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                    />
                  )}
                />
              </View>
              {errors.dueDate && (
                <Text className="mb-2 text-domio-danger">{errors.dueDate.message}</Text>
              )}
              {errors.dueTime && (
                <Text className="mb-2 text-domio-danger">{errors.dueTime.message}</Text>
              )}

              {/*
                La penalizacion (0017) tambien sale de la complejidad
                ahora — mismo XP que da al completarla, ver
                mission_xp_for_complexity en la migracion. Ya no hay
                input para esto, solo se muestra cuanto es.
              */}
              <Text className="mb-2 text-xs text-domio-danger">
                Si no se cumple, resta {MISSION_COMPLEXITY_REWARDS[complexity].xp} XP al Domio
              </Text>
            </>
          )}

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
          renderItem={({ item }) => {
            const completable = canCompleteMission(item);
            return (
              <MissionRow
                mission={item}
                onToggle={
                  item.status === "pending" && completable
                    ? () => completeMission.mutate(item.id)
                    : undefined
                }
                lockedReason={
                  item.status === "pending" && !completable
                    ? `Solo la puede completar ${item.assigneeName ?? "el asignado"}`
                    : undefined
                }
              />
            );
          }}
        />
      )}
    </View>
  );
}
