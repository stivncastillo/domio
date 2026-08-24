# Domio

> Tu familia. Tu mundo. Tus misiones.

App de gamificacion familiar hecha en **Expo (React Native) + TypeScript**,
con **Supabase** como backend. Ver `DOMIO — Product & UX Brief.md` (en la
raiz del repo) para el diseño completo de producto.

## Stack

| Capa | Eleccion | Por que |
|---|---|---|
| App movil | Expo SDK 57 (React Native 0.86) + TypeScript | Managed workflow: EAS compila los binarios en la nube, no necesitas Xcode/Android Studio para desarrollar. |
| Navegacion | Expo Router | Rutas basadas en archivos (como Next.js), ya integrado en el SDK. |
| Estilos | NativeWind (Tailwind para RN) | Si ya usas Tailwind en web, la sintaxis es la misma. |
| Backend | Supabase (Postgres + Auth + Realtime + Storage) | Free tier generoso, SQL relacional (encaja con familias/misiones/XP), Row Level Security para aislar datos por familia, Realtime para que todos vean a Domi reaccionar en vivo. |
| Estado servidor | TanStack Query | Cache, refetch automatico, estados de loading/error. |
| Estado local/UI | Zustand | Estado efimero (ej. animacion actual de Domi) que no vive en la base de datos. |
| Formularios | React Hook Form + Zod | Validacion tipada de formularios (login, crear mision, etc). |
| Animaciones | React Native Reanimated + Moti | Feedback "vivo" (Domi reaccionando, barras de XP, celebraciones). |
| Notificaciones | expo-notifications | Push notifications gratis vía el servicio de Expo. |

## Estructura de carpetas

```
app/                  Rutas (Expo Router). Cada archivo = una pantalla.
  _layout.tsx          Layout raiz: providers + decide (auth)/(onboarding)/(tabs)
  (auth)/               Login, registro
  (onboarding)/          Crear familia o unirse con codigo (usuario logueado sin familia todavia)
  (tabs)/               Dashboard, Misiones, Familia, Recompensas, Perfil
components/
  ui/                   Componentes de UI genericos (Card, ProgressBar...)
  domi/                 Componentes relacionados a la mascota Domi
lib/
  supabase.ts           Cliente de Supabase configurado
  queryClient.ts         Config de TanStack Query
stores/                 Stores de Zustand (estado local de UI)
types/
  domain.ts              Tipos de dominio (Mission, Reward, etc.)
  database.ts             Tipos generados desde el schema de Supabase
hooks/
  useAuth.ts              Hook de sesion (Supabase Auth)
  useFamilyMember.ts       ¿El usuario logueado ya tiene familia? (para el ruteo)
  useFamily.ts             Datos de la familia (nombre, invite_code) + lista de integrantes
  useMissions.ts           Listar/crear/completar misiones
  useDomioProgress.ts      Nivel y XP colectivo del Domio
  useRealtimeSync.ts       Suscripcion a Supabase Realtime (ver seccion Realtime)
supabase/
  migrations/
    0001_init.sql          Schema inicial (families, missions, XP, RLS de lectura...)
    0002_onboarding.sql     Trigger de perfil + policies de INSERT + RPC create_family
    0003_missions.sql       Policies de UPDATE + RPC complete_mission (otorga XP/nivel)
    0004_rename_to_english.sql   Solo para instalaciones existentes (ver seccion
                                  "Convencion de idioma" mas abajo) — no hace falta
                                  en un proyecto de Supabase nuevo.
    0005_remove_emoji.sql        Solo para instalaciones existentes: quita la
                                  columna emoji de missions/rewards — no hace
                                  falta en un proyecto de Supabase nuevo.
    0006_invite_members.sql      RPC join_family + cierra el hueco de la policy
                                  de INSERT en family_members. Este SÍ hace falta
                                  en cualquier instalación (nueva o existente).
    0007_enable_realtime.sql     Agrega domio_progress/missions/family_members a
                                  la publicación supabase_realtime. También hace
                                  falta en cualquier instalación.
```

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
npx expo install --fix
```

El segundo comando alinea las versiones de los paquetes nativos
(`expo-*`, `react-native-*`) exactamente con las que espera el SDK 57
instalado — es normal y recomendado correrlo despues de cualquier
`npm install` en un proyecto Expo.

### 2. Crear el proyecto de Supabase

1. Crea una cuenta gratis en [supabase.com](https://supabase.com) y un
   proyecto nuevo (elige la region mas cercana, ej. `sa-east-1`).
2. En **SQL Editor**, pega y ejecuta en orden el contenido de
   `supabase/migrations/0001_init.sql`, `0002_onboarding.sql`,
   `0003_missions.sql`, `0006_invite_members.sql` y
   `0007_enable_realtime.sql` (cada uno en una query nueva, en ese
   orden). Si es un proyecto de Supabase nuevo, no corras
   `0004_rename_to_english.sql` ni `0005_remove_emoji.sql` — ya no
   hacen falta, esos tres primeros archivos ya nacen con la
   nomenclatura en ingles y sin el campo emoji (ver "Convencion de
   idioma" mas abajo). `0006` y `0007` sí corren siempre, en cualquier
   instalación.
3. En **Authentication → Providers → Email**, apaga **"Confirm email"**
   mientras estas desarrollando (si no, cada usuario nuevo necesita
   click en un email de confirmacion antes de poder entrar, y el
   servicio de email gratis de Supabase tiene limites muy bajos).
4. En **Project Settings → API**, copia el `Project URL` y la
   `anon public key`.
5. Copia `.env.example` a `.env` y pega esos dos valores:

```bash
cp .env.example .env
```

### 3. Correr la app

```bash
npx expo start
```

Escanea el QR con la app **Expo Go** en tu celular, o presiona `i` / `a`
en la terminal para abrir un simulador de iOS/Android (si los tienes
instalados).

### 4. (Opcional) Generar tipos desde Supabase

Una vez el schema este aplicado, para tener autocompletado exacto
contra tu base de datos real:

```bash
npx supabase login
npx supabase gen types typescript --project-id TU-PROJECT-ID > types/database.ts
```

## Convencion de idioma (2026-08-24)

- **Codigo, variables y base de datos**: todo en ingles — nombres de
  archivos/rutas, componentes, hooks, funciones, columnas, tablas,
  valores de enum, nombres de policy de RLS. Ejemplos: `missions.tsx`
  (no `misiones.tsx`), `useCompleteMission` (no `useCompleteMision`),
  el enum `mission_status` usa `'pending' | 'completed' | ...` (no
  `'pendiente' | 'completada'`).
- **Texto de UI**: por ahora en español (`<Text>Crear misión</Text>`,
  etc.) — la idea a futuro es que esto sea configurable (es/en) con
  algo tipo `i18next`/`expo-localization`, pero eso todavia no esta
  implementado.
- **Comentarios explicativos y mensajes de `raise exception`**: quedan
  en español a proposito. Los comentarios son documentacion para vos,
  no corren en la base de datos ni se compilan; y los mensajes de
  `raise exception` de las funciones de Postgres terminan mostrandose
  tal cual en la UI (via `error.message`), asi que en la practica son
  texto de usuario, no codigo.
- Si en algun momento preferis que los comentarios tambien esten en
  ingles, aviso y se ajusta — por ahora se asumio que preferis
  mantenerlos en español ya que son para tu propio entendimiento del
  proyecto.

Como el proyecto ya tenia `0001`–`0003` aplicados en Supabase con los
valores viejos en español, `0004_rename_to_english.sql` existe
especificamente para migrar esa base ya existente (renombra los
valores de los enums con `alter type ... rename value`, que no toca
los datos existentes, solo la etiqueta con la que se muestran). Un
proyecto de Supabase nuevo NO necesita `0004`: `0001`-`0003` ya nacen
en ingles.

## Conceptos de Expo/RN que vas a encontrar (para quien viene de React web)

- **Expo Router vs React Router**: en vez de declarar rutas en codigo,
  cada archivo dentro de `app/` es automaticamente una ruta. Carpetas
  entre parentesis, como `(auth)` o `(tabs)`, agrupan pantallas sin que
  el nombre aparezca en la URL — son solo organizacion.
- **No hay DOM**: no hay `<div>`, `<span>`, `<button>`. Los bloques son
  `<View>`, el texto SIEMPRE va dentro de `<Text>` (no podes poner texto
  suelto dentro de un `<View>`), y los botones se hacen con `<Pressable>`.
- **Metro** es el bundler de RN (equivalente a Vite/Webpack).
- **EAS (Expo Application Services)** es el servicio en la nube que
  compila tus binarios `.ipa`/`.apk` sin que necesites Xcode/Android
  Studio localmente. Tiene un tier gratis que alcanza para desarrollo.
- **Expo Go** es una app generica que te deja probar tu proyecto en un
  celular real sin compilar nada — ideal en las primeras etapas, pero
  algunos paquetes nativos requieren un "development build" propio mas
  adelante (te avisaremos cuando lleguemos a eso).

## Como funciona el enrutamiento segun sesion/familia

`app/_layout.tsx` usa `Stack.Protected` (el patron actual de Expo Router
para rutas protegidas) con 3 estados, resueltos con `useAuth` +
`useCurrentFamilyMember`:

- Sin sesion -> grupo `(auth)` (login/registro).
- Con sesion pero sin fila en `family_members` -> `(onboarding)/create-family`.
- Con sesion y con familia -> `(tabs)` (la app real).

Cuando `create_family` corre (ver `(onboarding)/create-family.tsx`), se
invalida la query `["family-member", userId]` y el router pasa solo a
`(tabs)`, sin navegacion manual.

## Misiones (implementado 2026-08-23)

- Tab **Misiones**: crear misión (título, XP, tipo única/familiar,
  obligatoria o no) y completarla tocándola en la lista. No tiene campo
  de emoji — se sacó por completo del modelo (ver "Convención de
  idioma" y la migración `0005_remove_emoji.sql`).
- El Dashboard ya usa datos reales: nivel/XP del Domio
  (`useDomioProgress`) y hasta 3 misiones pendientes (`useMissions`).
- Completar una misión llama a la RPC `complete_mission`, que en un
  solo paso registra el completado y reparte el XP segun el tipo
  (`mission_type`, valores `single` | `family` | `recurring` | `habit`):
  - **`single`** ("Única" en la UI): el XP va al integrante que la
    completó (recalculando su nivel, cada 500 XP) y ademas suma al
    Domio.
  - **`family`** ("Familiar" en la UI): "cualquiera la completa" —
    basta con que un integrante la marque, y el XP entero va al Domio,
    nadie se lo lleva individualmente. Es la fase 1 de misiones
    familiares; la fase 2 (colaborativa, con subtareas asignadas a
    cada integrante que en conjunto completan la mision padre) queda
    pendiente de diseño.
  - En ambos casos el Domio sube de nivel cuando corresponde (umbral
    +200 XP por nivel).
- Alcance actual: solo misiones `single` y `family` (se completan una
  vez y quedan cerradas). `recurring` y `habit` quedan pendientes —
  necesitan lógica para generar una nueva ocurrencia en vez de cerrar
  la misión para siempre.
- `mission_assignees` (N:M mision-integrante) esta en el schema pero
  todavia no se usa desde la UI — hoy cualquier miembro de la familia
  puede completar cualquier mision. Es la tabla que probablemente se
  use para la fase 2 de misiones familiares (subtareas por integrante).

## Invitar miembros (implementado 2026-08-24)

- Tab **Familia** (`app/(tabs)/family.tsx`): muestra el nombre del
  Domio, el `invite_code` con un botón "Compartir código" (usa la API
  nativa `Share` de React Native, sin dependencias nuevas) y la lista
  de integrantes con su rol, nivel, XP y racha (`hooks/useFamily.ts`).
- Pantalla de onboarding **`(onboarding)/join-family.tsx`**: quien no
  tiene familia todavía puede, en vez de crear una, tipear un código y
  unirse a una existente. Llama a la RPC `join_family`, que valida el
  código y agrega al usuario como `member` (idempotente: tocar
  "Unirme" dos veces no rompe nada). Hay links cruzados entre
  `create-family.tsx` y `join-family.tsx` para pasar de una a la otra.
- Se sacó la policy de INSERT que dejaba que cualquier usuario se
  auto-agregara a *cualquier* `family_id` sin validar el código — un
  hueco de seguridad que nunca hacía falta porque crear/unirse siempre
  pasó (y sigue pasando) por funciones `security definer`. Ver
  `0006_invite_members.sql` para el detalle.

## Realtime (implementado 2026-08-24)

- `0007_enable_realtime.sql` agrega `domio_progress`, `missions` y
  `family_members` a la publicación `supabase_realtime` de Postgres —
  sin esto, los cambios ni siquiera quedan disponibles para que
  Realtime los transmita, sin importar qué haga el cliente.
- `hooks/useRealtimeSync.ts`: un solo `channel` de Supabase (un solo
  WebSocket) con tres suscripciones `postgres_changes`, una por tabla,
  filtradas por `family_id`. Cada evento simplemente invalida la query
  de TanStack Query correspondiente (`["domio-progress", familyId]`,
  `["missions", familyId]`, `["family-members", familyId]`) — así la
  próxima vez que esa pantalla se renderiza, pide los datos frescos.
  Se llama una sola vez desde `app/(tabs)/_layout.tsx` (que se
  mantiene montado mientras navegás entre tabs), no desde cada
  pantalla individual.
- No usamos el `old`/`new` que trae cada evento para comparar valores:
  con la configuración default de Postgres (`replica identity` = solo
  la primary key), el `old` de un UPDATE viene incompleto. Si más
  adelante hace falta distinguir, por ejemplo, "subió de nivel" de
  "solo sumó XP", hay que correr
  `alter table domio_progress replica identity full;` primero.
- De yapa: `stores/useDomiStore.ts` ya tenía `isCelebrating` sin usar
  desde el scaffold inicial. Ahora `useRealtimeSync` lo dispara cuando
  llega un cambio de XP del Domio, y `DomiAvatar.tsx` reacciona con un
  pulso y un mensaje distinto mientras dura — la primera vez que Domi
  "reacciona en vivo" de verdad, como lo describe el brief de producto.

## Proximos pasos sugeridos

1. Recompensas: crear/reclamar recompensas con puntos (tablas `rewards`
   y `reward_redemptions` ya existen en el schema, falta la UI + RPC).
2. Misiones recurrentes/hábitos (ver nota de alcance arriba).
3. Fase 2 de misiones familiares colaborativas (ver seccion de
   Misiones arriba).
4. Feed de actividad familiar usando `mission_completions` (hoy solo
   es historial, no se lee desde ninguna pantalla ni tiene Realtime).
