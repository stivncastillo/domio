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
   `0011_family_mission_coins.sql`, `0012_domio_level_curve.sql` y
   `0013_reward_redemptions_insert_policy.sql` (cada uno en una query
   nueva, en ese orden). Si es un proyecto de Supabase nuevo, no
   corras `0004_rename_to_english.sql` ni `0005_remove_emoji.sql` —
   ya no
   hacen falta, esos tres primeros nomenclatura en ingles y sin el
   campo emoji (ver "Convencion de idioma" mas abajo). `0006`, `0007`,
   `0008`, `0009`, `0010`, `0011`, `0012` y `0013` sí corren siempre,
   en cualquier instalación.
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

## Proximos pasos sugeridos

1. Misiones recurrentes/hábitos (ver nota de alcance arriba).
2. Fase 2 de misiones familiares colaborativas (ver seccion de
   Misiones arriba).
3. Feed de actividad familiar usando `mission_completions` (hoy solo
   es historial, no se lee desde ninguna pantalla ni tiene Realtime).
4. Historial de canjes por integrante (`reward_redemptions` ya se
   registra, falta una pantalla que lo muestre).
