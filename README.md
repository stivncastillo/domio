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
  useRewards.ts            Listar/crear recompensas + reclamarlas (gasta coins)
  useDomioProgress.ts      Nivel y XP colectivo del Domio
  useRealtimeSync.ts       Suscripcion a Supabase Realtime (ver seccion Realtime)
supabase/
  migrations/
    0001_init.sql          Schema inicial (families, missions, XP, RLS de lectura...)
    0002_onboarding.sql     Trigger de perfil + policies de INSERT + RPC create_family
    0003_missions.sql       Policies de UPDATE + RPC complete_mission (otorga XP/coins;
                                  version original — 0009 la reemplaza)
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
    0008_mission_roles_and_assignment.sql   Solo el admin crea/asigna misiones;
                                  un miembro común ve solo las suyas. También
                                  hace falta en cualquier instalación.
    0009_rewards_and_coins.sql   Saca xp/level individual de family_members
                                  (solo el Domio sube de nivel), agrega coins +
                                  RPC redeem_reward (coins + nivel del Domio).
                                  También hace falta en cualquier instalación.
    0010_create_mission_rpc.sql  RPC create_mission (arregla un bug real de
                                  RETURNING+RLS al crear misiones). También
                                  hace falta en cualquier instalación.
    0011_family_mission_coins.sql   complete_mission reparte coins también en
                                  misiones "family" (antes solo en "single"),
                                  a quien la completa. También hace falta en
                                  cualquier instalación.
    0012_domio_level_curve.sql   Curva de dificultad para subir de nivel del
                                  Domio (fácil hasta nivel 10, exponencial
                                  después). También hace falta en cualquier
                                  instalación.
    0013_reward_redemptions_insert_policy.sql   Agrega la policy de INSERT
                                  que le faltaba a reward_redemptions
                                  (arregla un bug real al reclamar
                                  recompensas). También hace falta en
                                  cualquier instalación.
    0014_reward_redemption_limits.sql   Límite de canjes por recompensa
                                  (una sola vez, o cada X días) + RPC
                                  reward_lock_status_for_family para
                                  mostrarlo en la UI. También hace
                                  falta en cualquier instalación.
    0015_mission_deadlines_and_penalties.sql   Vencimiento de misiones
                                  obligatorias + penalización de XP al
                                  Domio (xp_penalty, mission_penalties,
                                  RPC process_overdue_missions).
                                  También hace falta en cualquier
                                  instalación.
    0016_family_streak.sql       RPC recompute_family_streak — racha
                                  familiar real (domio_progress.
                                  family_streak_days). También hace
                                  falta en cualquier instalación.
    0017_mission_complexity.sql  Complejidad de misiones (Baja/Media/
                                  Alta): el XP/coins/xp_penalty salen
                                  de una tabla fija, no se escriben a
                                  mano. También hace falta en
                                  cualquier instalación.
    0018_complete_mission_assignee_check.sql   Solo el asignado (o
                                  cualquiera en misiones "family")
                                  puede completar una misión — antes el
                                  admin podía completar la de
                                  cualquiera. También hace falta en
                                  cualquier instalación.
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
   `0003_missions.sql`, `0006_invite_members.sql`,
   `0007_enable_realtime.sql`, `0008_mission_roles_and_assignment.sql`,
   `0009_rewards_and_coins.sql`, `0010_create_mission_rpc.sql`,
   `0011_family_mission_coins.sql`, `0012_domio_level_curve.sql`,
   `0013_reward_redemptions_insert_policy.sql`,
   `0014_reward_redemption_limits.sql`,
   `0015_mission_deadlines_and_penalties.sql`,
   `0016_family_streak.sql`, `0017_mission_complexity.sql` y
   `0018_complete_mission_assignee_check.sql` (cada uno en una query
   nueva, en ese orden). Si es un proyecto de Supabase nuevo, no
   corras `0004_rename_to_english.sql` ni `0005_remove_emoji.sql` —
   ya no hacen falta, esos tres primeros nomenclatura en ingles y sin
   el campo emoji (ver "Convencion de idioma" mas abajo). `0006` a
   `0018` (salteando 0004/0005) sí corren
   siempre, en cualquier instalación.
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
  - **`single`** ("Única" en la UI): el XP va al Domio (no hay
    nivel/XP individual — ver "Recompensas y monedas" más abajo), y el
    integrante que la completó gana además `coin_reward` en coins,
    para gastar en recompensas.
  - **`family`** ("Familiar" en la UI): "cualquiera la completa" —
    basta con que un integrante la marque, y el XP entero va al Domio,
    nadie se lo lleva individualmente. Las coins sí son individuales
    también acá (desde `0011_family_mission_coins.sql`): quien la
    marca como completada gana `coin_reward` en coins, igual que en
    `single`. Es la fase 1 de misiones familiares; la fase 2
    (colaborativa, con subtareas asignadas a cada integrante que en
    conjunto completan la mision padre) queda pendiente de diseño.
  - En ambos casos el Domio sube de nivel cuando corresponde, según la
    curva de dificultad descrita en "Curva de nivel del Domio" más
    abajo.
- Alcance actual: solo misiones `single` y `family` (se completan una
  vez y quedan cerradas). `recurring` y `habit` quedan pendientes —
  necesitan lógica para generar una nueva ocurrencia en vez de cerrar
  la misión para siempre.
- **Crear una misión llama a la RPC `create_mission`**
  (`0010_create_mission_rpc.sql`), no a un insert directo del cliente.
  Bug real encontrado por Stiven: insertar directo con
  `.select("id").single()` (para el RETURNING) explotaba con "new row
  violates row-level security policy for table missions" —el mismo
  problema de fondo que `create_family` (el RETURNING de un INSERT
  exige pasar también la policy de SELECT de la tabla, y esa
  evaluación se comporta distinto en el contexto de RETURNING que en
  un SELECT aparte). La RPC, al ser `security definer`, resuelve esto
  igual que `create_family`/`join_family`.
- El checkbox **"Obligatoria"** ahora sí hace lo que su label siempre
  dijo ("resta XP si no se cumple") — ver "Vencimiento de misiones y
  penalización de XP" más abajo.

## Vencimiento de misiones y penalización de XP (2026-08-29)

Una misión marcada **Obligatoria** ahora tiene que tener fecha/hora de
vencimiento y cuánto XP le resta al Domio si no se cumple a tiempo —
las dos cosas juntas, no por separado (un `check` constraint en
`missions` lo exige: `is_mandatory` implica `due_at` + `xp_penalty`
ambos presentes). Una misión no obligatoria sigue sin vencimiento,
igual que siempre.

- **`supabase/migrations/0015_mission_deadlines_and_penalties.sql`**
  (aplica en cualquier instalación): agrega `missions.xp_penalty`, el
  constraint de arriba, y extiende `create_mission` con dos parámetros
  nuevos (`mission_due_at`, `mission_xp_penalty`) — como
  `create or replace function` no permite cambiarle la lista de
  parámetros a una función ya aplicada, esta migración primero
  `drop`ea la versión vieja de 7 parámetros (`0010`) y crea la nueva
  de 9.
  - **Ojo si ya tenías misiones "Obligatoria" creadas antes de esta
    migración**: como ese checkbox no hacía nada hasta ahora, es
    esperable tener misiones viejas con `is_mandatory = true` pero sin
    fecha/penalización — el constraint nuevo las rechaza de entrada
    (`check constraint "mission_mandatory_needs_deadline_and_penalty"
    ... is violated by some row`). La migración ya incluye un
    `update` que las des-marca como obligatorias automáticamente
    antes de agregar el constraint (no se les inventa una fecha de la
    nada); si querés que alguna de esas misiones tenga vencimiento de
    verdad, volvé a editarla desde la app después de correr la
    migración.
- **Detección de vencidas**: se evaluaron dos opciones con Stiven (vía
  AskUserQuestion) y se eligió la más simple — **chequeo bajo demanda
  cuando alguien de la familia abre la app**, no un cron de Supabase
  (pg_cron). La RPC nueva `process_overdue_missions(family_id)` se
  llama una vez desde `hooks/useRealtimeSync.ts` (mismo lugar donde ya
  se monta la suscripción de Realtime) cada vez que alguien entra a
  `(tabs)`: busca misiones obligatorias `pending` con `due_at` en el
  pasado, las marca `failed`, resta `xp_penalty` al `current_xp` del
  Domio (sin bajar de 0, sin afectar el nivel) y deja un registro en
  la tabla nueva `mission_penalties`. Contra conocida y aceptada: si
  nadie abre la app, la penalización se aplica recién cuando alguien
  entra, no exactamente a la hora del vencimiento.
- **Card de aviso**: `mission_penalties` se agregó a la publicación de
  Realtime. `hooks/useRealtimeSync.ts` escucha sus INSERT y llama a
  `useDomiStore.showMissionPenalty(...)`, que dispara
  `components/domi/MissionPenaltyCard.tsx` — un card flotante montado
  una sola vez en `app/(tabs)/_layout.tsx` (visible sin importar en
  qué tab estés) con el título de la misión y el XP perdido. Se
  esconde solo a los 5 minutos (`setTimeout` en `useRealtimeSync`,
  cancelable a mano con el botón "✕" del card) — se decidió que el
  card se muestre **a toda la familia** (vía AskUserQuestion), mismo
  criterio que ya usan las animaciones de Domi al ganar XP, porque el
  XP perdido es del Domio (colectivo), no de un integrante en
  particular.
- **Form de misiones**: cuando se tilda "Obligatoria" aparecen tres
  campos nuevos — fecha (`AAAA-MM-DD`), hora (`HH:MM`, 24hs) y "XP que
  resta si no se cumple". Son inputs de texto simples, no un date
  picker nativo: agregar uno (ej.
  `@react-native-community/datetimepicker`) es una dependencia nueva
  que requeriría reconstruir el dev client, y este entorno de
  desarrollo no tiene acceso al registry de npm para instalarla y
  probarla — queda como mejora posible más adelante, sin tocar el
  resto del flujo.
- De paso se corrigió un detalle que había quedado desactualizado en
  `components/ui/MissionRow.tsx`: el badge de coins se ocultaba para
  misiones `family` (`mission.type !== "family"`), herencia de antes
  de `0011_family_mission_coins.sql` cuando las coins solo se pagaban
  en `single`. Ahora se muestra para los dos tipos, que es como
  efectivamente reparte coins `complete_mission` desde 0011.

Pendiente de que Stiven confirme: correr
`0015_mission_deadlines_and_penalties.sql` en su SQL Editor, crear una
misión obligatoria con vencimiento cercano (unos minutos) y volver a
abrir la app después de esa hora para ver el card y la misión marcada
como no cumplida.

## Racha familiar + fix de la barra de progreso (2026-08-29)

Dos pedidos juntos: implementar "la racha familiar" de verdad, y
arreglar que la barra de XP del Domio no se veía visualmente.

**Racha familiar** — mismo caso que `is_mandatory` antes de 0015:
`domio_progress.family_streak_days` existe desde el scaffold original
y ya se mostraba en el Dashboard ("🔥 Racha familiar: N días"), pero
ninguna migración la actualizaba nunca — quedaba pegada en 0 para
siempre.

- **`supabase/migrations/0016_family_streak.sql`** (aplica en
  cualquier instalación): función nueva `recompute_family_streak(family_id)`.
  Interpretación (razonable, no confirmada palabra por palabra —
  avisar si Stiven prefiere otro criterio): la racha cuenta días
  calendario **consecutivos** en los que la familia completó **al
  menos una misión** (cualquier integrante, cualquier tipo — mismo
  criterio "colectivo" que ya usa el XP del Domio), y se corta apenas
  pasa un día entero sin ninguna misión completada.
- En vez de mantener un contador que se incrementa/resetea a mano, la
  función **recalcula la racha desde cero** cada vez que se llama,
  mirando el historial real en `mission_completions` — más simple y
  sin estado que se pueda desincronizar. Se llama desde dos lugares
  (mismo patrón "bajo demanda" que `process_overdue_missions` en
  0015): al abrir la app (`hooks/useRealtimeSync.ts`) y justo después
  de completar una misión (`hooks/useMissions.ts`, para que suba al
  toque el mismo día). Como es idempotente, llamarla desde los dos
  lugares no duplica nada.
- No hizo falta agregar nada a Realtime: `domio_progress` ya está en
  la publicación desde 0007, así que el `update` de la función dispara
  la suscripción que ya existía.
- **Limitación conocida**: el "día" se calcula con la zona horaria del
  servidor de Postgres (UTC en Supabase por default), no con la zona
  horaria de cada familia — alcanza para una app familiar por ahora.
- **Ojo**: esto es la racha **familiar** (colectiva). La racha
  **individual** (`family_members.streak_days`, la que se ve en la tab
  Familia junto al nombre de cada integrante) sigue sin implementar —
  Stiven pidió específicamente la familiar, la individual queda
  pendiente de que la pida (tiene sus propias preguntas de diseño: si
  cuenta cualquier misión o solo las asignadas a esa persona).

**Barra de progreso invisible** — bug real encontrado en
`components/ui/ProgressBar.tsx`, no un problema de datos. La versión
anterior armaba el ancho así:

```ts
width: `${withTiming(pct, { duration: 500 })}%`
```

Eso no funciona en Reanimated: `withTiming(...)` no devuelve un
número, devuelve un descriptor de animación que Reanimated solo sabe
interpretar cuando se lo asigna DIRECTO a una propiedad del estilo
(ej. `width: withTiming(120)` con píxeles). Meterlo adentro de un
template string hace que JS lo convierta a texto antes de que
Reanimated pueda hacer nada ("[object Object]%"), así que el `width`
terminaba siendo inválido — la barra quedaba con ancho 0, invisible.
Afectaba tanto a la barra de XP del Domio como a la de "Reto
familiar" (las dos usan este mismo componente).

Fix: un `useSharedValue` numérico (0-100) animado con `withTiming` en
un `useEffect` cuando cambia `progress`, y el estilo arma el string
`${pct.value}%` LEYENDO el shared value adentro del worklet de
`useAnimatedStyle` — ahí sí es válido, porque lo que se interpola es
un número plano en cada frame, no el descriptor de `withTiming` en sí.

Pendiente de que Stiven confirme: correr `0016_family_streak.sql` en
su SQL Editor, completar una misión y ver que la racha familiar suba
en el Dashboard, y confirmar visualmente que la barra de XP del Domio
ahora se ve y se anima.

## XP numérico en el Dashboard (2026-08-30)

Antes de este cambio, el Home solo mostraba la barra de progreso del
Domio sin ningún número — no había forma de saber cuánto XP tenía
exactamente ni cuánto faltaba para el próximo nivel salvo "mirando el
largo de la barra".

Se agregó una fila de texto justo debajo de la barra de XP (mismo
patrón que ya usaba la tarjeta de "Reto familiar" para mostrar
"38 / 50"), con dos datos a la vez:

- Izquierda, en gris (`text-domio-muted`): `current_xp / xp_to_next_level XP`
  — el XP acumulado en el nivel actual sobre el umbral de ese nivel.
- Derecha, en el color de acento (`text-domio-primary`), en negrita:
  `Faltan N XP para el nivel M` — lo que falta para subir de nivel.

Importante para no confundirse con los nombres de las columnas:
`domio_progress.xp_to_next_level` es el **umbral del nivel actual**
(cuánto XP hay que juntar en total en este nivel), no un "restante" —
ver `xp_required_for_level()` en `0012_domio_level_curve.sql`. Lo que
falta para el próximo nivel es la resta `xp_to_next_level - current_xp`,
calculada en el componente (con un `Math.max(..., 0)` puramente
defensivo: `complete_mission` ya sube de nivel apenas `current_xp`
cruza el umbral, así que no debería quedar nunca en negativo, pero
evita mostrar "Faltan -20 XP" si algún dato queda desincronizado un
instante).

No hizo falta tocar ninguna migración ni ningún hook — `useDomioProgress`
ya traía `currentXp` y `xpToNextLevel`, solo faltaba mostrarlos en
`app/(tabs)/index.tsx`.

## Complejidad de misiones: XP/coins ya no se escriben a mano (2026-08-30)

Stiven pidió, palabras textuales: "calculemos que las misiones tengan
complejidad, osea que el admin no ingrese el XP ni los coins, eso se
maneja por debajo. Alta: urgente (se ganan Y xp, X coins). Media:
moderada (se ganan menos xp y coins que la alta). Baja: facil (se gana
poco)." Motivo de fondo: hasta ahora el admin escribía el XP/coins de
cada misión a mano, sin ningún límite salvo el validador del form (1 a
200) — un Domio podía llegar a nivel alto con pocas misiones si a
alguien se le ocurría poner números grandes.

Antes de implementar se resolvieron 3 preguntas de diseño con Stiven
(via AskUserQuestion, con tablas de ejemplo mostrando cuántas misiones
hacían falta para llegar a nivel 11 según cada opción):

1. **Valores de XP/coins por complejidad**: eligió "Moderado" — Baja =
   15 XP / 8 coins, Media = 30 XP / 15 coins, Alta = 50 XP / 25 coins.
2. **Migración de misiones ya existentes** (que tenían XP/coins puestos
   a mano): eligió asignarles a TODAS complejidad `medium`, sin
   intentar adivinar por heurística cuál se parecía a cuál.
3. **La penalización de XP** por no cumplir una misión obligatoria
   (`xp_penalty`, ver sección de vencimiento de misiones más arriba)
   también era un campo manual — eligió que pase a calcularse sola por
   complejidad también, con el mismo criterio simétrico: se pierde el
   mismo XP que se hubiera ganado al completarla.

Implementado en `supabase/migrations/0017_mission_complexity.sql`
(aplica en CUALQUIER instalación):

- Enum `mission_complexity` (`low` | `medium` | `high`) + dos funciones
  `immutable`, `mission_xp_for_complexity(complexity)` y
  `mission_coins_for_complexity(complexity)` — un solo lugar define la
  tabla de valores (mismo patrón que `xp_required_for_level()` en
  0012_domio_level_curve.sql), se usan tanto en `create_mission` como
  en un **CHECK constraint nuevo** (`mission_rewards_match_complexity`)
  que exige `xp_reward = mission_xp_for_complexity(complexity)`,
  `coin_reward = mission_coins_for_complexity(complexity)` y
  `xp_penalty = mission_xp_for_complexity(complexity)` para TODA fila
  de `missions`. Esto no es solo una validación del form: como es un
  constraint de la base, ni siquiera un insert directo a la tabla
  (saltándose `create_mission`) puede terminar con XP/coins que no
  correspondan a la complejidad declarada — "se maneja por debajo"
  queda garantizado por Postgres, no solo por la UI.
- `missions.complexity` (columna nueva, default `medium`). Backfill:
  TODAS las misiones existentes pasan a `medium`, y sus
  `xp_reward`/`coin_reward`/`xp_penalty` se recalculan a los valores de
  `medium` para no violar el constraint nuevo de entrada (los valores
  viejos que tenían puestos a mano se pierden — decisión explícita de
  Stiven en la pregunta 2 de arriba).
- **`create_mission` recreada**: los parámetros `mission_xp_reward`,
  `mission_coin_reward` y `mission_xp_penalty` se sacaron; se
  reemplazan por un solo `mission_complexity` (default `medium`). La
  función calcula XP/coins internamente con las dos funciones de
  arriba antes de insertar — el cliente ya no puede mandar ningún
  número, solo la complejidad. Mismo detalle técnico que en 0015:
  `create or replace function` no permite cambiar la lista de
  parámetros de una función ya aplicada, así que hizo falta un `drop
  function if exists create_mission(...)` con la firma vieja de 9
  parámetros antes de crear la nueva de 7.

Frontend:

- `types/domain.ts`: `MissionComplexity` (`"low" | "medium" | "high"`);
  `Mission` gana `complexity`. `MISSION_COMPLEXITY_LABELS` (Baja/Media/
  Alta, para mostrar) y `MISSION_COMPLEXITY_REWARDS` (los mismos
  números que la migración, **solo para el preview del form** — la
  fuente de verdad real sigue siendo la base, garantizada por el CHECK
  constraint).
- `hooks/useMissions.ts`: `useMissions` trae/mapea `complexity`.
  `CreateMissionInput` perdió `xpReward`/`coinReward`/`xpPenalty`, gana
  `complexity`; `useCreateMission` manda `mission_complexity` a la RPC
  en vez de los tres números sueltos.
- `app/(tabs)/missions.tsx`: los inputs numéricos de XP y monedas se
  reemplazaron por 3 chips (Baja/Media/Alta) con un texto debajo
  mostrando cuánto da esa complejidad ("Da +30 XP y +15 🪙 al
  completarla"); cuando la misión es obligatoria, el input de "XP que
  resta" también se sacó — se muestra el número calculado, no editable
  ("Si no se cumple, resta 30 XP al Domio").
- `components/ui/MissionRow.tsx`: cada misión de la lista ahora muestra
  su complejidad ("Complejidad: Alta", con un color distinto por
  nivel) además del XP/coins que ya mostraba.

Pendiente de que Stiven confirme: correr
`0017_mission_complexity.sql` en su SQL Editor (las misiones que ya
tenía quedan en complejidad Media con los valores recalculados) y
probar crear una misión de cada complejidad para confirmar que el
XP/coins que se ganan al completarla coincide con lo que mostraba el
preview del form.

**Nota para el futuro (mencionada por Stiven, a pensar más adelante)**:
nada impide hoy que el admin marque TODAS las misiones como Alta — la
complejidad en sí es honesta (no hay forma de inflar el número dentro
de un nivel), pero si alguien quisiera, podría poner todo en Alta para
subir más rápido igual. Stiven lo notó y decidió explícitamente dejarlo
para más adelante ("no sé cómo manejar eso, pero creo que lo pensamos
después") — no se implementó ninguna mitigación todavía (ideas a futuro:
límite de misiones Alta por día/semana, o que el nivel del Domio
condicione qué complejidades puede crear el admin).

## Curva de nivel del Domio (2026-08-26)

Antes de esto el umbral para subir de nivel era fijo: nivel 1→2 ya
pedía 1000 XP (default de la columna), y cada nivel siguiente sumaba
200 XP más al umbral (`xp_to_next_level + 200`, hardcodeado dentro de
`complete_mission`). Muy duro para arrancar y crecía poco después.

Stiven pidió una curva donde los primeros niveles suban fácil/rápido y
"después del nivel 10 se pone más complejo" — se le presentaron tres
curvas posibles (vía AskUserQuestion, con ejemplos numéricos de cada
una) y eligió la que tiene un quiebre explícito en el nivel 10:

- **`supabase/migrations/0012_domio_level_curve.sql`** (aplica en
  cualquier instalación) agrega la función `xp_required_for_level(nivel)`:
  - Nivel ≤ 10: lineal, `50 + 30*(nivel-1)` → 50, 80, 110, 140... XP.
  - Nivel > 10: exponencial, `320 * 1.25^(nivel-10)` → 320, 400, 500...
    XP, acelerando cada vez más.
  - Ejemplos: nivel 1→2 = 50 XP, nivel 5→6 = 170 XP, nivel 10→11 =
    320 XP, nivel 15→16 = 977 XP, nivel 20→21 = 2980 XP.
- Esta función reemplaza el literal `1000` como default de
  `domio_progress.xp_to_next_level` y el `+ 200` hardcodeado dentro de
  `complete_mission` — un solo lugar define la curva, no queda
  duplicada.
- La migración también recalcula el umbral de cualquier familia que ya
  tuviera `domio_progress` (con la curva vieja) para su nivel actual —
  sin tocar el `current_xp` ya ganado — y si con la curva nueva (más
  fácil al principio) ese progreso ya alcanza para subir uno o más
  niveles de una, los aplica ahí mismo (mismo loop que usa
  `complete_mission`).

## Roles y asignación de misiones (implementado 2026-08-24)

Antes de esto, cualquier miembro podía crear misiones y cualquiera
podía completar cualquiera — Stiven notó que una misión creada por un
miembro se veía (y se podía completar) desde las dos cuentas. Esto no
seguía el brief de producto (sección "Roles familiares": crear/asignar
misiones es del Administrador/Padre, no del Miembro) y además es un
hueco real: un miembro podría inventarse una misión de mucho XP y
autocompletarla sin supervisión.

- **Solo el admin de la familia crea misiones** (`0008_mission_roles_and_assignment.sql`,
  policy de INSERT en `missions`). El botón "+ Nueva" y el formulario
  ni siquiera se muestran si no sos admin (`app/(tabs)/missions.tsx`).
- **Una misión `single` se asigna a un integrante puntual** al crearla
  (picker de chips con los integrantes de la familia, usa
  `mission_assignees` — la tabla N:M que ya estaba en el schema desde
  0001 pero sin usar). Es obligatorio elegir a alguien para este tipo.
  Las misiones `family` no llevan asignado — siguen siendo "cualquiera
  la completa".
- **Un miembro común solo ve (y puede completar) sus propias misiones
  `single` + las `family`.** El admin ve todas. Esto se resuelve con
  dos funciones helper nuevas (`is_admin_of_family`, `can_view_mission`)
  usadas en las policies de SELECT/UPDATE de `missions` — no es un
  filtro de la UI, es la base de datos la que directamente no entrega
  las filas que no te corresponden.
- Efecto secundario esperado: misiones `single` que hayas creado
  *antes* de este cambio, sin asignar a nadie, van a quedar visibles
  solo para el admin (no matchean ni "soy el admin" obviamente para un
  miembro, ni "soy el asignado" porque no tienen asignado, ni
  "type = family"). No es un bug — son datos de prueba viejos que
  quedaron huérfanos; se pueden borrar o reasignar a mano desde el SQL
  Editor si molestan.
- `MissionRow` ahora muestra "Asignada a {nombre}" (o "Sin asignar")
  en las misiones únicas, en vez del badge de familiar.

## Invitar miembros (implementado 2026-08-24)

- Tab **Familia** (`app/(tabs)/family.tsx`): muestra el nombre del
  Domio, el `invite_code` con un botón "Compartir código" (usa la API
  nativa `Share` de React Native, sin dependencias nuevas) y la lista
  de integrantes con su rol, coins y racha (`hooks/useFamily.ts`) —
  no hay nivel/XP individual, ver "Recompensas y monedas" más abajo.
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

## Recompensas y monedas (implementado 2026-08-26)

Hasta acá las misiones daban XP, pero no había nada que hacer con eso
más que subir de nivel — faltaba la otra mitad del loop del negocio
(ganar → gastar → recompensa). Diseño final, en dos pasadas con
Stiven:

1. Primero se evaluó gastar directo del XP (simple, pero bajaría de
   nivel al comprar algo, raro) vs. una moneda separada. Se eligió la
   moneda separada.
2. Después Stiven se dio cuenta de algo más de fondo: "¿para qué el
   miembro un nivel? no estamos compitiendo entre los miembros. Solo
   el domio, y con ello el domio nos desbloquea las recompensas."
   O sea, el nivel/XP individual no tenía sentido — se sacó por
   completo (`family_members` ya no tiene `xp` ni `level`, **solo el
   Domio sube de nivel**, progreso colectivo). Lo individual pasó a
   ser pura moneda (`coins`). Y una recompensa no es solo cuestión de
   tener las coins: también exige que el Domio haya llegado a cierto
   nivel — las dos condiciones a la vez ("la recompensa necesita que
   el domio esté en nivel 7 y tengas 1000 coins, si estás en un nivel
   inferior, así tengas las coins no la puedes obtener aun").

Diseño final (`0009_rewards_and_coins.sql`, aplica en cualquier
instalación; también se editó `0001_init.sql` para que un proyecto
nuevo ya nazca sin `xp`/`level` individual):

- **`coins`** es la única moneda individual, en `family_members`. Se
  gana en misiones y se gasta libremente en recompensas — no hay
  nivel ni XP por integrante.
- Cada misión (`single` y `family`) tiene `coin_reward` (además del
  `xp_reward`, que sigue yendo entero al Domio en los dos casos). En
  `single` las coins van al asignado; en `family` van a quien la
  completa (desde `0011_family_mission_coins.sql` — antes las
  misiones `family` no repartían coins individualmente, solo XP).
- **`rewards`** tiene `cost_coins` (antes `cost_points`) y
  `min_domio_level` (nuevo, default 1 = sin requisito extra).
- **Solo el admin crea recompensas** (mismo motivo que las misiones:
  si cualquiera pudiera crear una, le pondría costo 0 y nivel 1, y se
  la reclamaría gratis desde el arranque).
- **RPC `redeem_reward(target_reward_id)`**: chequea que el Domio haya
  llegado al `min_domio_level` de la recompensa **Y** que alcancen las
  `coins`, descuenta y registra el canje en `reward_redemptions`, todo
  en una transacción — evita quedar en negativo por dos taps rápidos
  en "Reclamar". Necesita la policy de INSERT en `reward_redemptions`
  agregada en `0013_reward_redemptions_insert_policy.sql` — sin ella
  el insert final de la función explota con "violates row-level
  security policy" (a `reward_redemptions` le faltaba esa policy desde
  el scaffold original; `mission_completions` sí la tenía, por eso
  `complete_mission` nunca tuvo este problema).
- Tab **Recompensas** (`app/(tabs)/rewards.tsx`, antes placeholder):
  muestra tu balance de coins y el nivel actual del Domio arriba, la
  lista de recompensas con su costo y su nivel mínimo (si tiene uno),
  y un botón "Reclamar" que se deshabilita si falta cualquiera de las
  dos condiciones — con un 🔒 aclarando cuando es por nivel. Admin ve
  además el form de creación (con el campo de nivel mínimo).

## Límite de canjes por recompensa (2026-08-26)

Stiven pidió una restricción extra además de nivel + coins: "solo se
pueden reclamar una vez cada x tiempo, una hamburguesa puede ser
redimida 1 vez cada 15 días, un viaje solo puede ser redimido una vez,
un vestuario solo puede ser redimido una vez."

El alcance del límite (confirmado vía AskUserQuestion) sigue al campo
`is_family_reward` que ya existía (hasta ahora puramente decorativo):

- **Recompensa individual**: cada integrante tiene su propio contador
  — la hamburguesa de un integrante no bloquea la de otro.
- **Recompensa familiar**: el límite es compartido por toda la
  familia — el viaje se agota para todos apenas uno lo reclama, sin
  importar quién.

Implementado en `supabase/migrations/0014_reward_redemption_limits.sql`
(aplica en cualquier instalación):

- `rewards.redemption_limit_type` (enum `unlimited` | `once` |
  `cooldown`, default `unlimited`) + `rewards.cooldown_days` (solo
  tiene valor cuando el tipo es `cooldown`; hay un `check` en la
  tabla que lo obliga).
- **`redeem_reward`** ahora chequea el límite ANTES que nivel/coins:
  para `once`, si ya existe algún canje que cuente (según el alcance
  de arriba) lo rechaza para siempre; para `cooldown`, si el último
  canje que cuenta fue hace menos de `cooldown_days`, lo rechaza hasta
  esa fecha.
- **RPC nueva `reward_lock_status_for_family(target_family_id)`**:
  devuelve, para cada recompensa de la familia, si está bloqueada
  ahora mismo y desde cuándo vuelve a estar disponible. Hace falta
  como RPC aparte (`security definer`) porque la policy de SELECT de
  `reward_redemptions` solo deja ver tus propios canjes (o todos si
  sos admin) — un integrante común no puede ver si OTRO ya canjeó una
  recompensa familiar leyendo la tabla directo. Esta función solo
  expone booleanos/fechas, nunca quién canjeó qué ni cuánto gastó.
- `app/(tabs)/rewards.tsx`: el form de creación (admin) suma tres
  chips ("Sin límite" / "Una sola vez" / "Cada X días", con el campo
  de días cuando corresponde). La lista usa
  `useRewardLockStatus` para mostrar 🔒 con el motivo exacto ("Ya fue
  reclamada" o "Disponible de nuevo el ...") y deshabilita "Reclamar"
  igual que con nivel/coins.

## Bug real: el admin podía completar misiones asignadas a otro (2026-08-30)

Stiven reportó, palabras textuales: "Hay algo raro, como admin creo
las misiones, las asigno a otro miembro y las puedo completar, no
debería dejar completar misiones que no están asignadas a mi usuario
actual."

Causa: `complete_mission` (última versión en 0012_domio_level_curve.sql)
nunca chequeaba el asignado — solo validaba "sos miembro de la familia
de esta misión". Para un integrante común esto no se notaba porque la
RLS de `missions` (`can_view_mission`, 0008_mission_roles_and_assignment.sql)
ya le oculta las misiones `single` que no son suyas — el `select`
interno de la función (`security invoker`, corre bajo el RLS de quien
llama) directamente no encontraba la fila, y la función explotaba con
"Misión no encontrada" antes de llegar a completarla. Pero el ADMIN
puede ver TODAS las misiones de su familia por diseño (para poder
gestionar/asignar) — y esa visibilidad amplia se estaba colando como
permiso de COMPLETAR, que es un permiso distinto: "puedo ver esta
misión para administrarla" no implica "puedo marcarla como hecha yo
mismo aunque sea de otro integrante".

Fix en `supabase/migrations/0018_complete_mission_assignee_check.sql`
(aplica en CUALQUIER instalación — el signature de `complete_mission`
no cambia, así que no hizo falta ningún `drop function`):

- `complete_mission` ahora chequea explícitamente `mission_assignees`:
  si la misión NO es `family` Y tiene al menos un asignado registrado,
  solo puede completarla quien está en esa lista — ni siquiera el
  admin se salta esto. El chequeo se aplica siempre, sin depender de
  la RLS de SELECT (que sigue dejando ver la misión al admin para
  gestionarla, solo que ya no alcanza para completarla). Si una misión
  quedó sin ningún asignado (dato huérfano viejo, ver la nota de
  0008 más arriba), se sigue dejando pasar — de todos modos solo el
  admin llega a verla.
- Frontend (`app/(tabs)/missions.tsx` y `app/(tabs)/index.tsx`): mismo
  criterio replicado del lado del cliente para no ofrecer un tap que
  de todos modos iba a fallar — `canCompleteMission(mission)` decide
  si se pasa `onToggle` a `MissionRow` o, en cambio, un `lockedReason`
  ("🔒 Solo la puede completar {nombre}") que el componente muestra en
  vez del botón de completar.
- `components/ui/MissionRow.tsx` gana la prop `lockedReason?: string`.

Antes de tocar `missions.tsx`/`index.tsx`/`MissionRow.tsx` se
re-verificó (hábito de siempre) que el Mac no tuviera cambios manuales
pendientes — sin diferencias en ninguno.

Pendiente de que Stiven confirme: correr
`0018_complete_mission_assignee_check.sql` en su SQL Editor, y probar
como admin que una misión `single` asignada a otro integrante ya no
se pueda completar (ni tocando la fila, ni si se intentara llamar a la
RPC directo) — debería mostrar el candado en vez del botón.

## Rediseño del Home (2026-08-30)

Stiven pidió, palabras textuales: "centremonos en el Home ya que
tenemos un MVP de la primera versión", con la lista completa de
secciones que tiene que tener. Este cambio es 100% frontend + una
consulta nueva — ninguna migración SQL.

Orden final de `app/(tabs)/index.tsx` (de arriba hacia abajo, tal cual
se pidió):

1. **"Hola {nombre}"** — el nombre sale de la misma lista de
   integrantes que ya trae `useFamilyMembers` (buscando el que matchea
   `session.user.id`), no hizo falta un hook nuevo.
2. **"{Nombre de la familia} — Nivel N"** — antes decía literal
   "Domio — Nivel N"; ahora usa `useFamily(familyId)` (ya existía,
   se usaba en la tab Familia) para traer el nombre real.
3. **Mascota Domi** — sin cambios (`DomiAvatar`), solo se movió arriba
   de la barra de XP (antes iba después).
4. **Progreso de XP** — sin cambios de lógica, la barra + los números
   + "Faltan N XP" (agregados el 2026-08-30 en el cambio anterior) +
   la racha familiar.
5. **"Mis misiones"** — cambio real de comportamiento, no solo
   visual: antes mostraba las primeras 3 misiones PENDIENTES DE TODA
   LA FAMILIA (visibles según RLS, que para el admin es todas). Ahora
   filtra de verdad por "asignada a mí" (`type !== "family"` y mi
   `family_member.id` está en `assignedTo`) — mismo criterio que ya
   valida `complete_mission` del lado de la base desde
   `0018_complete_mission_assignee_check.sql`. Como el filtro ya
   garantiza que son completables por mí, esta sección ya NO necesita
   el `lockedReason`/candado que se agregó en el fix anterior — todo
   lo que aparece acá se puede completar con un tap. Gana un link
   "Ver todas →" a la tab Misiones (`expo-router`'s `<Link>`, ya usado
   en otras pantallas como `create-family.tsx`).
6. **"Misiones familiares"** (card aparte, ya no "Reto familiar"):
   reemplaza el card fijo hardcodeado (`38 / 50`, "Completar 50
   misiones esta semana") por las misiones reales de tipo `family`
   pendientes — cualquiera de la familia puede completarlas. El
   mecanismo que pidió Stiven de "completá X esta semana y reciban tal
   recompensa" queda para más adelante — por ahora es la lista real,
   sin ninguna mecánica de progreso semanal todavía (ver "Próximos
   pasos sugeridos").
7. **"🤝 Equipo Domio"**: sección nueva, la única que necesitó una
   consulta nueva. Muestra cuánto XP aportó cada integrante al Domio
   ESTA SEMANA, con el subtítulo textual que pidió Stiven ("Así
   estamos avanzando juntos.") y termina con el total. A propósito
   **no está ordenada por XP** (ni con ningún indicador visual tipo
   barra comparativa) — Stiven pidió explícitamente evitar que se
   sienta como un ranking competitivo, así que los integrantes
   aparecen en el mismo orden en que se unieron a la familia.

   Implementado en `hooks/useFamily.ts`, hook nuevo
   `useWeeklyContributions(familyId)`: sin ninguna migración nueva —
   usa `mission_completions.xp_awarded`, que ya existe desde 0009 y
   registra cuánto XP le sumó cada completada al Domio (no hay XP
   individual, ver `0009_rewards_and_coins.sql`); acá se suma "al
   revés", agrupado por `family_member_id`, para ver cuánto aportó
   cada uno al total colectivo — no es una métrica nueva del lado de
   la base, es la misma información mirada desde otro ángulo. Se
   agregan a la cuenta las completadas desde el lunes 00:00 en
   adelante, en la hora LOCAL del dispositivo (a diferencia de la
   racha familiar de 0016, que corta el "día" según la zona horaria
   del SERVIDOR — ahí no importaba tanto porque cuenta días ya
   cerrados; acá el usuario espera que el contador arranque de nuevo
   cada lunes según SU reloj). Se trae la lista de integrantes primero
   para que quien no completó nada esta semana igual aparezca con
   0 XP, en vez de faltar de la lista.

   Se actualiza en vivo sin agregar ninguna suscripción de Realtime
   nueva: `hooks/useRealtimeSync.ts` ya invalida `domio-progress` en
   cada UPDATE de esa tabla (dispara con cada misión completada por
   cualquiera en la familia) — se agregó una invalidación más de
   `["weekly-contributions", familyId]` en ese mismo callback (mismo
   patrón de "piggybackear en una suscripción que ya existe" que se
   usó para la racha familiar en 0016_family_streak.sql).
8. **"🎁 Recompensas disponibles"**: hasta 3 recompensas que YA se
   pueden reclamar ahora mismo (nivel del Domio alcanzado, coins
   suficientes, y sin bloqueo por límite de canjes) — mismas 3
   condiciones que ya valida `redeem_reward`, reusadas acá solo para
   filtrar qué mostrar (el botón de reclamar en sí sigue viviendo
   únicamente en la tab Recompensas). Link "Ver todas →" a esa tab.
9. **"🔜 Se desbloquea en el nivel N+1"**: recompensas cuyo
   `minDomioLevel` es EXACTAMENTE el próximo nivel del Domio — un
   teaser de "qué sigue", no de todo lo que falta a futuro. Si el
   próximo nivel no desbloquea nada nuevo, muestra un mensaje neutro
   en vez de esconder el card.

Nota: se detectó (via `device_stage_files` + diff, hábito de siempre
antes de tocar un archivo que Stiven podría haber editado a mano) que
`app/(tabs)/index.tsx` tenía dos líneas de `console.log` de debug
agregadas manualmente en el Mac, más una diferencia de formato de una
línea (probablemente un auto-formatter). Como este cambio reescribe el
archivo por completo para el rediseño, esos `console.log` de debug NO
se preservaron — avisar si hacían falta para algo en curso.

Pendiente de que Stiven pruebe el Home nuevo de punta a punta: que el
saludo y el nombre de familia sean correctos, que "Mis misiones" ya
NO muestre misiones de otros integrantes, que "Misiones familiares"
liste las de tipo familiar pendientes, que "Equipo Domio" muestre el
aporte semanal de cada uno (con 0 XP para quien no completó nada esta
semana) y que las dos secciones de recompensas coincidan con lo que
se ve en la tab Recompensas.

## Reset de datos de juego (2026-08-29)

Para vaciar misiones/recompensas/progreso sin perder usuarios, familias
ni membresías (útil para volver a probar el onboarding desde cero, o
limpiar datos de prueba), hay un script aparte —no es una migración,
no cambia el schema— en `supabase/scripts/reset_game_data.sql`. Se
corre a mano en el SQL Editor las veces que haga falta.

Borra por completo `mission_completions`, `mission_assignees`,
`missions`, `reward_redemptions` y `rewards`. Resetea (sin borrar la
fila) `domio_progress` a nivel 1 y `family_members.coins` /
`streak_days` a 0, porque son contadores derivados del historial que
se acaba de borrar. No toca `auth.users`, `profiles`, `families` ni
las filas de `family_members` (quién pertenece a qué familia y con
qué rol). Es irreversible — sin backup automático.

## Proximos pasos sugeridos

1. Misiones recurrentes/hábitos (ver nota de alcance arriba).
2. Fase 2 de misiones familiares colaborativas (ver seccion de
   Misiones arriba).
3. Feed de actividad familiar usando `mission_completions` (hoy solo
   es historial, no se lee desde ninguna pantalla ni tiene Realtime).
4. Historial de canjes por integrante (`reward_redemptions` ya se
   registra, falta una pantalla que lo muestre).
5. Mecánica de "reto semanal" en el card de Misiones familiares del
   Home: completar X misiones familiares en la semana desbloquea una
   recompensa — hoy el card solo lista las misiones familiares
   pendientes (ver "Rediseño del Home"), sin ningún contador de
   progreso ni recompensa asociada todavía.
6. Racha individual por integrante (`family_members.streak_days`,
   mostrada en la tab Familia) — sigue sin ninguna lógica que la
   actualice, mismo estado que antes de la racha familiar de 0016.
