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
  (onboarding)/          Crear familia (usuario logueado sin familia todavia)
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
  useFamilyMember.ts       ¿El usuario logueado ya tiene familia?
  useMissions.ts           Listar/crear/completar misiones
  useDomioProgress.ts      Nivel y XP colectivo del Domio
supabase/
  migrations/
    0001_init.sql          Schema inicial (families, missions, XP, RLS de lectura...)
    0002_onboarding.sql     Trigger de perfil + policies de INSERT + RPC create_family
    0003_misiones.sql       Policies de UPDATE + RPC complete_mission (otorga XP/nivel)
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
   `supabase/migrations/0001_init.sql`, `0002_onboarding.sql` y
   `0003_misiones.sql` (cada uno en una query nueva, en ese orden).
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
- Con sesion pero sin fila en `family_members` -> `(onboarding)/crear-familia`.
- Con sesion y con familia -> `(tabs)` (la app real).

Cuando `create_family` corre (ver `(onboarding)/crear-familia.tsx`), se
invalida la query `["family-member", userId]` y el router pasa solo a
`(tabs)`, sin navegacion manual.

## Misiones (implementado 2026-08-23)

- Tab **Misiones**: crear misión (título, XP, tipo única/familiar,
  obligatoria o no — el emoji usa el default de la base de datos, no se
  pide en el formulario) y completarla tocándola en la lista.
- El Dashboard ya usa datos reales: nivel/XP del Domio
  (`useDomioProgress`) y hasta 3 misiones pendientes (`useMisiones`).
- Completar una misión llama a la RPC `complete_mission`, que en un
  solo paso registra el completado y reparte el XP segun el tipo:
  - **Única**: el XP va al integrante que la completó (recalculando su
    nivel, cada 500 XP) y ademas suma al Domio.
  - **Familiar**: "cualquiera la completa" — basta con que un
    integrante la marque, y el XP entero va al Domio, nadie se lo lleva
    individualmente. Es la fase 1 de misiones familiares; la fase 2
    (colaborativa, con subtareas asignadas a cada integrante que en
    conjunto completan la mision padre) queda pendiente de diseño.
  - En ambos casos el Domio sube de nivel cuando corresponde (umbral
    +200 XP por nivel).
- Alcance actual: solo misiones "única" y "familiar" (se completan una
  vez y quedan cerradas). "Recurrente" y "hábito" quedan pendientes —
  necesitan lógica para generar una nueva ocurrencia en vez de cerrar
  la misión para siempre.
- `mission_assignees` (N:M mision-integrante) esta en el schema pero
  todavia no se usa desde la UI — hoy cualquier miembro de la familia
  puede completar cualquier mision. Es la tabla que probablemente se
  use para la fase 2 de misiones familiares (subtareas por integrante).

## Proximos pasos sugeridos

1. Flujo de invitacion: hoy `family_members` solo permite que un usuario
   se agregue a si mismo (`profile_id = auth.uid()`); falta una forma de
   que otro integrante se una a una familia existente via `invite_code`
   (ya esta la columna en `families`, falta la pantalla + el RPC).
2. Suscribirse a Realtime en `domio_progress` y `mission_completions`
   para que el estado de Domi se actualice en vivo entre dispositivos
   sin depender de refetch manual de TanStack Query.
3. Recompensas: crear/reclamar recompensas con puntos (tablas `rewards`
   y `reward_redemptions` ya existen en el schema, falta la UI + RPC).
4. Misiones recurrentes/hábitos (ver nota de alcance arriba).
