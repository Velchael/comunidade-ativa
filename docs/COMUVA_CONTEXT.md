# COMUVA_CONTEXT.md

# COMUVA — Contexto Maestro del Proyecto

## Estado del documento

- Alcance: cierre de Fase 1D + actualización documental Fase 1E.4B
- Estado: `FASE 1D CERRADA Y VALIDADA EN PRODUCCIÓN`; `FASE 1E PARCIALMENTE IMPLEMENTADA Y DESPLEGADA`
- Fuente de validación: código actual de `backend`, `frontend` y migraciones Sequelize
- Regla oficial: este documento describe el sistema real implementado, no el diseño aspiracional

---

# 1. Estado actual del proyecto

## Resumen ejecutivo

COMUVA es una plataforma comunitaria con arquitectura híbrida:

- visibilidad global de interacciones
- ownership local por comunidad
- membresías locales por comunidad
- moderación contextual
- sesiones persistentes server-side con refresh cookie HttpOnly
- access JWT corto en memoria frontend

## Estado por área

### `COMPLETADO`

- autenticación JWT con `login`, `me` y `refresh`
- sesiones persistentes en `auth_sessions`
- refresh cookie `comuva_refresh`
- logout backend por sesión presentada
- sincronización de sesión desde backend en `UserContext`
- modelo `comunidades`
- modelo `users`
- modelo `comunidad_miembros`
- `owner_user_id` en comunidades
- resolución híbrida de roles vía `comunidadRoles`
- respuesta autenticada normalizada vía `buildAuthUserResponse`
- panel de miembros de comunidad
- gestión de roles locales
- interacciones globales
- respuestas cross-community
- owner efectivo como admin local efectivo

### `EN USO`

- `rol_global` en `users`
- `rol_comunidad` en `comunidad_miembros`
- `owner_user_id` en `comunidades`
- `auth_sessions` para persistencia segura de sesión
- `refreshAuthSession`
- polling de `Interacciones`
- middlewares híbridos de comunidad
- onboarding para crear o unirse a una comunidad

### `PRODUCCIÓN CANDIDATA`

- comunidades
- miembros de comunidad
- interacciones
- respuestas
- refresco de sesión y rehidratación del usuario autenticado
- autenticación persistente con cookie HttpOnly validada en producción

Estas áreas ya tienen flujo backend coherente, persistencia real en PostgreSQL y representación frontend alineada con el backend.

### `LEGACY / DEPRECADO`

- uso de `users.rol` como autoridad local
- uso directo de `req.user.comunidad_id` como única fuente de permisos locales
- lógica de autorización de `grupos` basada principalmente en `req.user.rol`
- lógica de autorización de `tareas` mezclando middleware híbrido con chequeos legacy internos

### `PENDIENTE`

- alinear `grupos` completamente al sistema híbrido
- alinear `tareas` completamente al sistema híbrido
- auditar `reportes` end-to-end contra las reglas híbridas
- definir creación multi-comunidad
- reemplazo eventual del polling por tiempo real

---

# 2. Arquitectura oficial

## 2.1 Entidades principales

### `users`

Persistencia principal del usuario autenticado.

Campos relevantes:

- `id`
- `email`
- `username`
- `rol`
- `rol_global`
- `comunidad_id`

Rol de la tabla:

- identidad del usuario
- rol global persistido
- única comunidad activa actual; el campo conserva compatibilidad con la futura selección de comunidad principal
- compatibilidad con flujos legacy

Estado:

- `EN USO`
- parcialmente `LEGACY` por la coexistencia `rol` + `rol_global`

### `comunidades`

Persistencia principal de comunidades.

Campos relevantes:

- `id`
- `nombre_comunidad`
- `nombre_administrador`
- `activa`
- `owner_user_id`
- `objetivo`
- `tipo`
- `visibilidad`
- `ciudad`
- `pais`

Rol de la tabla:

- identidad de la comunidad
- ownership oficial
- configuración básica

Estado:

- `EN USO`

### `comunidad_miembros`

Tabla oficial de membresías locales.

Campos relevantes:

- `user_id`
- `comunidad_id`
- `rol_comunidad`
- `estado`
- `es_principal`

Rol de la tabla:

- relación usuario-comunidad
- rol local
- membresía activa/inactiva
- comunidad activa única del usuario en la fase actual; `es_principal` queda preparado para una futura capacidad multi-comunidad

Estado:

- `EN USO`
- `SOURCE OF TRUTH` para permisos locales, junto con `owner_user_id`

### `auth_sessions`

Tabla oficial de sesiones persistentes de autenticación.

Campos relevantes:

- `id`
- `user_id`
- `family_id`
- `refresh_token_hash`
- `previous_refresh_token_hash`
- `rotation_counter`
- `rotated_at`
- `previous_valid_until`
- `last_used_at`
- `expires_at`
- `absolute_expires_at`
- `revoked_at`
- `revoked_reason`

Rol de la tabla:

- persistir sesiones independientes por browser, device o login context
- permitir múltiples sesiones activas coexistentes del mismo usuario
- almacenar sólo hashes SHA-256 de refresh credentials
- sostener rotación, race grace y revocación por sesión presentada

Estado:

- `EN USO`
- `SOURCE OF TRUTH` para refresh persistente server-side
- no define un constraint de exactamente una sesión por dispositivo

## 2.2 Relaciones oficiales

### `users` -> `comunidades`

- `users.comunidad_id` apunta a la única comunidad activa actual del usuario; la noción de comunidad principal entre varias queda reservada para una fase futura
- esta relación sigue existiendo por compatibilidad y navegación operativa

### `users` <-> `comunidades` vía `comunidad_miembros`

- relación muchos a muchos
- representa la membresía real, limitada en la fase actual a una sola comunidad activa por usuario
- permite evolución futura a multi-comunidad, pero no habilita esa capacidad durante la Fase 4C

### `comunidades.owner_user_id` -> `users.id`

- identifica al owner persistido de la comunidad
- no reemplaza la membresía
- complementa la membresía local

---

# 3. Fuente de verdad

## Regla oficial

- Backend = `fuente de verdad`
- PostgreSQL = `persistencia oficial`
- Frontend = `representación de estado`

## Implicancias

- el frontend no define permisos
- el frontend no define ownership
- el frontend no define el rol efectivo final
- la sesión persistida en `localStorage` es solo caché temporal
- el backend reconstruye el estado autenticado real mediante `buildAuthUserResponse`

## Backend como autoridad

El backend valida:

- token
- usuario real en base de datos
- comunidad activa
- owner
- membresía local
- rol local efectivo
- privilegios globales

## Frontend como consumidor

El frontend consume y representa:

- `rol_global`
- `rol_comunidad`
- `is_owner`
- `can_manage_comunidad`
- `comunidadNombre`

Si hay divergencia entre lo persistido localmente y la base real, el backend corrige el estado mediante `auth/refresh`.

---

# 3A. Autenticación y persistencia de sesión

## 3A.1 CURRENT PRODUCTION STATE

Estado:

- `FASE 1D CERRADA Y VALIDADA EN PRODUCCIÓN`
- autenticación persistente server-side implementada
- Google direct callback validado en producción
- redirect limpio sin JWT en URL
- refresh cookie HttpOnly validada
- access JWT corto emitido después del refresh
- logout/revocación por sesión presentada validado

COMUVA usa actualmente:

- Google OAuth mediante Passport con `session: false`
- login legacy por email y contraseña
- tabla/modelo productivo `auth_sessions`
- refresh credential opaca en cookie HttpOnly
- access JWT corto para llamadas autenticadas
- access JWT moderno guardado sólo en memoria frontend
- backend y PostgreSQL RDS como autoridad de usuario, comunidad, ownership,
  membresía y roles

`auth_sessions` representa sesiones independientes por browser, device o login
context. Pueden coexistir múltiples sesiones activas del mismo usuario. El modelo no
define ni garantiza un constraint de exactamente una sesión por dispositivo.

Campos contractuales relevantes de `auth_sessions`:

- `id`
- `user_id`
- `family_id`
- `refresh_token_hash`
- `previous_refresh_token_hash`
- `rotation_counter`
- `rotated_at`
- `previous_valid_until`
- `last_used_at`
- `expires_at`
- `absolute_expires_at`
- `revoked_at`
- `revoked_reason`

## 3A.2 Refresh credential y cookie

La refresh credential de COMUVA es opaca para el cliente. El formato implementado es:

- `sessionId.secret`
- `sessionId` = UUID canónico de `auth_sessions.id`
- `secret` = 32 bytes aleatorios codificados en base64url

El plaintext de la refresh credential nunca se almacena en RDS. La tabla persiste
sólo `SHA-256(secret)` en `refresh_token_hash`. Durante la rotación, el hash anterior
se conserva temporalmente en `previous_refresh_token_hash` para manejar races.

Cookie productiva:

- nombre: `comuva_refresh`
- `HttpOnly`
- `Secure` en producción
- `SameSite=Lax`
- `Path=/api/auth`
- host-only
- sin `Domain`
- `maxAge` limitado por el mínimo entre `expires_at` y `absolute_expires_at`

TTL reales:

- access JWT: `15 minutos`
- inactivity lifetime: `180 días`
- absolute lifetime: `365 días`
- race grace: `10 segundos`

## 3A.3 Access JWT actual

El access JWT moderno se emite con `createAccessToken` y contiene `token_use:
'access'`. Su TTL real es `15m`.

Payload relevante:

- `id`
- `email`
- `rol`
- `rol_global`
- `username`
- `googleId`
- `comunidad_id`
- `token_use='access'`
- `iat` y `exp` agregados por la biblioteca JWT

El frontend moderno no persiste este access JWT en `localStorage`; vive en memoria de
`authClient`. Tras reload o nueva apertura, el frontend recupera sesión mediante
`POST /api/auth/refresh` usando la cookie HttpOnly.

## 3A.4 Endpoints auth actuales

### CURRENT PRODUCTION STATE

`POST /api/auth/refresh`

- requiere origen permitido por `requireAuthOrigin`
- lee `comuva_refresh`
- valida y rota refresh credential bajo lock transaccional
- actualiza `previous_refresh_token_hash`, `rotation_counter`, `rotated_at`,
  `previous_valid_until`, `last_used_at` y `expires_at`
- reconstruye el usuario autoritativo desde PostgreSQL
- emite nueva cookie `comuva_refresh`
- devuelve `access_token`, `token_type='Bearer'`, `expires_in=900` y `user`
- devuelve `409 AUTH_REFRESH_RACE` para carrera recuperable dentro del grace
- limpia cookie en errores definitivos 401
- preserva sincronización browser/backend ante fallos temporales posteriores al
  commit de rotación

`POST /api/auth/logout`

- requiere origen permitido por `requireAuthOrigin`
- es idempotente
- revoca únicamente la sesión presentada por la cookie actual
- usa `revoked_at` y `revoked_reason='user_logout'`
- limpia la cookie aunque la credencial ya no sea válida

`POST /api/auth/session/migrate`

- bridge temporal desde JWT legacy
- acepta JWT legacy válido o expirado recientemente hasta 7 días desde `iat`
- rechaza access JWT moderno con `token_use='access'`
- crea `auth_session`, emite cookie y devuelve access JWT corto
- no fue eliminado y debe conservarse mientras existan clientes/sesiones legacy

### LEGACY COMPATIBILITY

`GET /api/auth/refresh` sigue existiendo como endpoint legacy Bearer:

- recibe el JWT legacy por `Authorization: Bearer`
- verifica firma con `ignoreExpiration: true`
- renueva hasta 7 días desde `iat`
- devuelve `{ token, user }`
- no emite refresh cookie
- no rota `auth_sessions`

Este endpoint debe documentarse como compatibilidad, no como el flujo moderno.

## 3A.5 Google OAuth

### CURRENT FLOW

Flujo actual:

`GET /api/auth/google`
-> Passport Google
-> callback `/api/auth/google/callback`
-> `googleCallback`
-> `authSessionService.createSession({ userId, transaction })`
-> `buildRefreshCookieOptions` dentro de la transacción
-> commit
-> `Set-Cookie: comuva_refresh`
-> redirect limpio a `/seinscrever`
-> frontend bootstrap
-> `POST /api/auth/refresh`
-> access JWT corto + usuario autoritativo.

El callback Google actual:

- no crea JWT para el redirect
- no usa `?token=`
- no llama `createAccessToken`
- no llama `buildAuthUserResponse`
- no devuelve secret ni datos sensibles en la URL
- emite la cookie sólo después de que la transacción commit exitosamente

Validación productiva Fase 1D:

- Google direct callback OK
- exactly one `auth_session` para el intento E2E controlado
- `/session/migrate = 0` en nuevos logins Google
- `/seinscrever?token= = 0`
- `POST /api/auth/refresh = 200`
- rotación normal
- sesión persistente
- retorno correcto a invitación
- membership creada sólo después de aceptación explícita
- logout/no-restauración previamente validado

La observación "exactly one `auth_session`" describe el intento E2E controlado. No es
un constraint global del modelo ni impide múltiples sesiones activas del mismo usuario.

### LEGACY FALLBACK

`/api/auth/session/migrate` conserva compatibilidad con el callback histórico que
entregaba un JWT legacy a `/seinscrever?token=...`. `Seinscrever` todavía acepta
`?token=` legacy, limpia la URL y migra la sesión si aparece.

Ese fallback no forma parte del flujo Google moderno.

## 3A.6 Frontend auth

Estados actuales de `UserContext`:

- `hydrating`
- `authenticated`
- `unauthenticated`
- `temporarilyUnavailable`

Bootstrap actual:

- arranca en `hydrating`
- intenta `POST /api/auth/refresh` con cookie HttpOnly
- si no hay cookie utilizable y existe `localStorage.token`, intenta migración legacy
- si no hay cookie ni legacy, queda `unauthenticated`
- si hay error temporal 5xx/network, queda `temporarilyUnavailable`

Persistencia frontend actual:

- access JWT moderno vive sólo en memoria
- `localStorage.token` no es la credencial moderna principal
- `localStorage.token` queda sólo como bridge temporal legacy
- `localStorage.user` no autentica ni se usa como autoridad

Single-flight:

- `refreshInFlight` controla refresh concurrentes
- `migrateInFlight` controla migraciones concurrentes

Auth generation:

- `authEpoch` invalida operaciones y respuestas pertenecientes a una generación
  anterior de autenticación
- respuestas tardías después de logout o de una nueva sesión no restauran un estado
  obsoleto

Otros comportamientos reales:

- `logoutPending` bloquea requests protegidas nuevas durante logout remoto pendiente
- `logoutPending` permite retry de logout remoto
- refresh preventivo cuando el access JWT vence en `<= 2 min`
- listeners de recuperación: `focus`, `visibilitychange`, `online`
- 401 `AUTH_ACCESS_EXPIRED` refresca y reintenta una vez
- errores 5xx/network no deben transformarse automáticamente en credenciales
  inválidas
- no existe polling periódico global de autenticación en `UserContext`

## 3A.7 Invitaciones, link/QR y persistencia de intención

### CURRENT PRODUCTION CONTRACT

La intención pendiente del flujo link/QR de invitación se conserva en:

- `sessionStorage["comuva.pendingInvitationPath"]`

Flujo validado:

`/convite/:token`
-> validación pública
-> `pendingInvitationPath`
-> Google
-> callback directo
-> refresh
-> retorno al mismo convite
-> membership todavía `0`
-> aceptación explícita
-> backend valida
-> `comunidad_miembros`
-> acceso real a comunidad.

El flujo mediante link `/convite/:token` fue validado E2E en producción durante Fase
1D. El escaneo físico de QR no fue probado como E2E separado; el QR representa y
resuelve al mismo flujo de convite. QR/link no decide membership. El frontend sólo
conserva la intención de volver al convite. Backend/PostgreSQL RDS es la autoridad
sobre elegibilidad, aceptación y creación de membresía.

## 3A.8 Contrato real de invitaciones y `max_usos`

### HISTORICAL / PLANNED DESIGN

El diseño histórico contemplaba invitación individual con `max_usos=1`.

### CURRENT PRODUCTION STATE

La creación productiva actual fuerza:

- `estado='activa'`
- `expires_at=null`
- `max_usos=null`
- `usos_actuales=0`

Comportamiento auditado:

- una nueva invitación revoca invitaciones activas previas de esa comunidad
- la aceptación nueva incrementa `usos_actuales`
- la aceptación nueva actualiza `last_used_at`
- una invitación ilimitada permanece `activa`
- `already_member` es idempotente y no incrementa uso
- `membership_inactive` devuelve `409`
- `already_has_community` devuelve `409`
- invitaciones históricas limitadas siguen respetando `max_usos`

### PENDING PRODUCT DECISION

La diferencia entre el diseño histórico individual y el contrato productivo actual
permanente/ilimitado queda registrada como decisión de producto pendiente. No se debe
cambiar código desde este documento.

## 3A.9 PWA, Web Push y onboarding

### CURRENT PRODUCTION STATE

Infraestructura PWA/Web Push existente y confirmada en Fase 1E.1:

- `manifest.json`
- `start_url=/`
- `display=standalone`
- `scope=/` mediante registro del Service Worker
- iconos `favicon.ico`, `logo192.png`, `logo512.png`
- `theme_color=#2e7d32`
- `background_color=#ffffff`
- Service Worker en `/service-worker.js`
- manejo de `push`
- manejo de `notificationclick`
- Web Push con VAPID
- tabla `push_subscriptions`
- activación/desactivación de notificaciones desde perfil
- detección standalone/iOS usada actualmente para Push
- no existe estrategia offline/cache real confirmada
- el Service Worker se usa principalmente para Web Push

Separación oficial:

- Service Worker no es una sesión autenticada
- Web Push no restaura login
- `PushSubscription` identifica un destino navegador/dispositivo para entrega push,
  no autentica al usuario
- `endpoint`, `p256dh` y `auth` no son credenciales de login COMUVA
- `push_subscriptions`, VAPID y `notificationDeliveryService` permanecen separados de
  auth

### FASE 1E.1 — AUDITORÍA PWA INICIAL

Estado:

- `COMPLETADA`

Estado base confirmado:

- `manifest.json` presente
- `display=standalone`
- iconos `192` y `512`
- `service-worker.js` registrado en `/`
- Service Worker usado principalmente para Web Push
- sin estrategia offline/cache real documentada como implementada

### FASE 1E.2 — DETECCIÓN PWA

Estado:

- `IMPLEMENTADA`

Commit funcional:

- `c11d52f23052b3012dd097581ef4981b0d976291`
- `feat: add pwa install detection context`

Implementación:

- `frontend/src/PwaInstallContext.js`
- `PwaInstallProvider`
- `usePwaInstall()`
- detección standalone
- detección iOS/iPadOS
- `beforeinstallprompt`
- deferred prompt en memoria
- `appinstalled`
- `canPrompt`
- `promptInstall()`
- protección contra doble prompt

Estados implementados:

- `installed`
- `installable`
- `prompting`
- `manualInstall`
- `dismissed`
- `unavailable`

### FASE 1E.3 — ONBOARDING POST-ACEPTACIÓN

Estado:

- `IMPLEMENTADO`

Commit funcional:

- `c0aba833b261d9ec02327d85ee7b1824124cf15c`
- `feat: add post-invite pwa install onboarding`

Comportamiento actual:

`new-member` exitoso:

- muestra `Tudo certo!`
- mantiene `Entrar na comunidade` como acción principal
- muestra `Instalar COMUVA` como acción secundaria cuando `canPrompt=true`

iOS/iPadOS:

- muestra `Como instalar COMUVA`
- instrucciones manuales:
  - `Compartilhar`
  - `Adicionar à Tela de Início`
  - `Adicionar`

Estados especiales:

- `installed`: no muestra CTA de instalación; `Entrar na comunidade` permanece
- `dismissed`: no insiste; `Entrar na comunidade` permanece
- `unavailable`: queda silencioso; no significa necesariamente incompatibilidad;
  `Entrar na comunidade` permanece
- `already-member`: no ofrece PWA en esta fase
- refresh posterior fallido: no ofrece PWA y mantiene retry/login actual

Navegación final:

- `navigate('/interacciones', { replace: true })`

La instalación PWA no:

- crea membership
- autentica
- reemplaza auth
- dispara Push
- solicita Notification permission
- bloquea entrada a comunidad

### FASE 1E.4 — DEPLOY PRODUCCIÓN

Estado:

- `DESPLEGADA EN PRODUCCIÓN`

Compose real:

- `docker-compose.prod.yml`

Servicio reconstruido:

- `frontend`

Contenedores productivos:

- frontend: `comunidad-frontend`
- backend: `comunidad-backend`
- proxy: `nginx-proxy`

Deploy utilizado:

- `docker compose -f docker-compose.prod.yml build frontend`
- `docker compose -f docker-compose.prod.yml up -d --no-deps frontend`

Resultado:

- frontend recreado correctamente
- backend no recreado
- nginx no recreado
- restart counts `0`
- `https://comuva.com` respondió `200`
- `/manifest.json` respondió `200`
- `/service-worker.js` respondió `200`
- nuevo bundle servido

Assets del deploy:

- `main.f91371ed.js`
- `main.6e49ff5a.css`

Bundle confirmó presencia de:

- `Entrar na comunidade`
- `Instalar COMUVA`
- `Como instalar COMUVA`
- `/interacciones`

### E2E ANDROID/CHROME REAL

Estado:

- `EJECUTADO PARCIALMENTE`
- `DIAGNÓSTICO PENDIENTE`

Flujo validado hasta:

`convite`
-> Google
-> aceptación
-> membership
-> refresh
-> `Tudo certo!`
-> `Entrar na comunidade`

Resultado importante:

- no apareció `Instalar COMUVA` durante el E2E real Android/Chrome

Conclusión operativa:

- infraestructura PWA implementada
- onboarding implementado
- deploy producción exitoso
- E2E Android detectó ausencia del CTA de instalación
- diagnóstico de `beforeinstallprompt` pendiente
- Fase 1E no debe marcarse completamente cerrada todavía

No se debe afirmar todavía:

- que la instalación Android esté validada
- que `beforeinstallprompt` funciona en producción
- que PWA está completamente cerrada
- una causa raíz para la ausencia del CTA `Instalar COMUVA`

Diagnóstico pendiente:

- auditar por qué `beforeinstallprompt` no activó `canPrompt` en Android/Chrome
- auditar presencia/ausencia y comportamiento de `fetch` handler del Service Worker
  como posible factor relacionado
- no afirmar que el Service Worker sea la causa raíz hasta concluir Fase 1E.5A

### HISTÓRICO / YA IMPLEMENTADO

Las siguientes capacidades estaban pendientes al cierre de Fase 1D, pero ya existen
en el código actual y fueron desplegadas en producción durante Fase 1E:

- `beforeinstallprompt`
- `appinstalled`
- install state integrado al onboarding de invitación
- botón/promoción post-aceptación
- flujo guiado de instalación móvil/desktop donde el navegador lo permite

### REGLAS VIGENTES

COMUVA no puede instalarse automáticamente. El navegador y el usuario controlan la
instalación. La instalación PWA no debe ser requisito para entrar en la comunidad ni
para usar la web normal.

Regla de validación para Fase 1E:

- no asumir que instalar o abrir la PWA conserva o transfiere automáticamente el
  estado de autenticación del navegador
- la restauración de sesión de una PWA instalada debe validarse E2E por plataforma
- la restauración debe depender de credenciales aceptadas y validadas por backend
- no depender de asumir transferencia de `localStorage`
- no depender de asumir transferencia automática de sesión entre contextos sin prueba
  real
- una PWA instalada y el navegador no deben asumirse como el mismo contexto de
  storage/session
- Service Worker no es mecanismo de autenticación
- la autenticación sigue dependiendo de backend, `auth_sessions`, cookie HttpOnly y
  refresh

Experiencia objetivo implementada parcialmente:

`convite`
-> autenticación
-> aceptación
-> acceso a comunidad
-> ofrecer "Instalar COMUVA"
-> prompt nativo cuando esté disponible.

## 3A.10 HISTORICAL ISSUES RESOLVED

Quedan registrados como problemas históricos resueltos por Fase 1D:

- ausencia de `auth_sessions`
- ausencia de refresh cookie HttpOnly
- ausencia de logout backend por sesión
- Google callback con JWT en query string
- access JWT persistido como credencial moderna principal
- pérdida de sesión ante reload sin bridge server-side
- separación entre autenticación Google y aceptación explícita de membership,
  validada E2E en producción
- Google/auth_session no crea `comunidad_miembros`; la membership aparece únicamente
  después de la aceptación explícita del convite

## 3A.11 PENDING HARDENING

Pendientes conocidos:

- OAuth `state` sigue ausente
- auditar estrategia de account linking entre `email` y `googleId`
- evaluar selección explícita de cuenta Google con `prompt=select_account`
- desvincular `PushSubscription` durante logout
- evaluar `pageshow`/BFCache sólo como posible hardening UX, no como bug confirmado
- aplicar rate limiting a validación pública de invitaciones
- revisar alineación de códigos `AUTH_*` entre frontend y backend
- diagnosticar ausencia del CTA `Instalar COMUVA` en E2E real Android/Chrome
- completar Fase 1E.5A antes de declarar validada la instalación Android

### PENDIENTE CONOCIDO / FUERA DEL SCOPE PWA ACTUAL

La auditoría confirmó una discrepancia existente de códigos `AUTH_*`:

Backend:

- `AUTH_SESSION_IDLE_EXPIRED`
- `AUTH_SESSION_ABSOLUTE_EXPIRED`
- `AUTH_REFRESH_REUSE`

Frontend espera:

- `AUTH_SESSION_EXPIRED`
- `AUTH_REFRESH_REUSED`

Este pendiente no forma parte del diagnóstico de instalación Android y no debe
mezclarse con la investigación de `beforeinstallprompt`.

## 3A.12 NEXT PHASE

NEXT: `FASE 1E.5A — DIAGNÓSTICO ANDROID BEFOREINSTALLPROMPT`

Objetivo:

- diagnosticar por qué el E2E real Android/Chrome no mostró `Instalar COMUVA`
- validar si `beforeinstallprompt` se dispara en producción
- revisar criterios de instalabilidad reales del navegador
- auditar el Service Worker como posible factor sin asumir causa raíz

La Fase 1E ya implementó infraestructura y onboarding base, pero aún debe completar:

- diagnóstico Android/Chrome
- validación desktop Chromium
- validación iOS/Safari fallback manual
- validación E2E de sesión al abrir PWA instalada por plataforma

---

# 4. Sistema oficial de roles

## 4.1 Dimensiones de autorización

### `rol_global`

Vive en `users.rol_global`.

Define autoridad transversal del usuario sobre el sistema.

Valores implementados:

- `admin_total`
- `admin_basic`
- `miembro`

Estado:

- `EN USO`

### `rol_comunidad`

Vive en `comunidad_miembros.rol_comunidad`.

Define autoridad local dentro de una comunidad específica.

Valores implementados:

- `admin_total`
- `admin_basic`
- `moderador`
- `miembro`

Estado:

- `EN USO`

### `owner_user_id`

Vive en `comunidades.owner_user_id`.

Define ownership estructural de la comunidad.

Estado:

- `EN USO`

## 4.2 Roles efectivos

### `admin_total`

Alcance:

- global
- transversal a todas las comunidades

Permisos reales validados:

- crear comunidades por `POST /api/comunidades`
- editar y eliminar comunidades
- ver miembros de cualquier comunidad
- gestionar roles locales
- moderar interacciones
- moderar respuestas

Estado:

- `COMPLETADO`
- `EN USO`

### `owner`

Definición:

- usuario cuyo `id` coincide con `comunidades.owner_user_id`

Alcance:

- estructural sobre su comunidad

Permisos reales validados:

- editar su comunidad
- eliminar su comunidad
- ver miembros de su comunidad
- gestionar roles locales en su comunidad

Interpretación oficial:

- owner = `admin_basic` local efectivo para permisos de gestión local
- owner no equivale a `admin_total`
- owner no habilita crear comunidades adicionales por la ruta administrativa global

Estado:

- `COMPLETADO`
- `EN USO`

### `admin_basic` local

Definición:

- membresía activa en `comunidad_miembros` con `rol_comunidad = 'admin_basic'`

Alcance:

- comunidad específica

Permisos reales validados:

- ver miembros de su comunidad
- gestionar roles locales permitidos
- moderar interacciones de su comunidad
- moderar respuestas de su comunidad
- editar su comunidad en frontend/backend local

Estado:

- `COMPLETADO`
- `EN USO`

### `moderador`

Definición:

- membresía activa con `rol_comunidad = 'moderador'`

Alcance:

- comunidad específica

Permisos reales validados:

- moderar interacciones de su comunidad
- moderar respuestas de su comunidad
- no gestionar miembros
- no administrar comunidad

Estado:

- `COMPLETADO`
- `EN USO`

### `miembro`

Definición:

- membresía activa con `rol_comunidad = 'miembro'`

Permisos reales validados:

- crear interacciones
- listar interacciones visibles
- responder interacciones, incluso globales, usando su comunidad actual como contexto
- no moderar
- no gestionar miembros
- no administrar comunidad

Estado:

- `COMPLETADO`
- `EN USO`

## 4.3 Precedencia oficial

Orden práctico de precedencia:

1. `admin_total` global
2. `owner_user_id` para comunidad objetivo
3. `rol_comunidad` activo en `comunidad_miembros`
4. fallback legacy sobre `users.rol` y `users.comunidad_id` cuando corresponde

## 4.4 Excepciones oficiales

- `owner` no se expone como valor persistido de `rol_comunidad`; es una condición estructural
- `buildAuthUserResponse` expone `is_owner` y `can_manage_comunidad`
- `resolveRolComunidadHibrido` resuelve al owner como `admin_basic` efectivo salvo caso especial de membresía `admin_total`
- `users.rol` sigue coexistiendo por compatibilidad, pero no es la fuente oficial futura de permisos locales

---

# 5. Middleware y autorización oficial

## `verificarToken`

- valida JWT
- carga `req.user`
- protege endpoints autenticados

Estado:

- `COMPLETADO`
- `EN USO`

## `verificarRolComunidad`

Middleware genérico híbrido.

Hace:

- resuelve `comunidad_id`
- permite bypass de `admin_total` global cuando aplica
- consulta `tieneRolComunidad`
- adjunta `req.comunidadAuth`

Estado:

- `COMPLETADO`
- `EN USO`

## `allowListarMiembrosComunidad`

Permite:

- `admin_total`
- `owner`
- `admin_basic` local

Estado:

- `COMPLETADO`
- `EN USO`

## `allowGestionarRolesComunidad`

Permite:

- `admin_total`
- `owner`
- `admin_basic` local

Estado:

- `COMPLETADO`
- `EN USO`

## `ownershipComunidad`

Permite:

- `admin_total`
- owner real de la comunidad

Uso:

- `PUT /api/comunidades/:id`
- `DELETE /api/comunidades/:id`

Estado:

- `COMPLETADO`
- `EN USO`

## `syncComunidadMiembro`

Uso de compatibilidad:

- crea o corrige membresía desde estado legacy cuando existe `req.user.comunidad_id`

Estado:

- `EN USO`
- `DEPRECADO` como mecanismo de transición

---

# 6. Comunidades y creación de comunidades

## Ruta administrativa global

### `POST /api/comunidades`

Protección:

- `verificarToken`
- `onlyAdminTotal`

Puede crear:

- solo `admin_total`, siempre que no cree ni obtenga para sí una segunda comunidad activa

No puede crear:

- owner
- admin local
- moderador
- miembro

Efectos:

- crea comunidad
- asigna `owner_user_id`
- crea o corrige membresía del creador como `admin_basic` local sin permitir una membresía secundaria; cualquier comportamiento previo que la haya permitido durante la Fase 4C fue una omisión del requisito original y debe corregirse

Estado:

- `EN USO`

## Ruta de onboarding

### `POST /api/comunidades/onboarding`

Protección:

- token válido
- usuario autenticado existente
- `user.comunidad_id` debe ser nulo

Puede crear:

- cualquier usuario autenticado sin comunidad asignada

No puede crear:

- usuario ya vinculado a una comunidad

Efectos:

- crea comunidad
- asigna `owner_user_id`
- sincroniza usuario y membresía principal
- deja al creador como `admin_basic` local

Estado:

- `EN USO`

## Conclusión oficial

La creación de comunidades hoy tiene dos carriles:

- carril administrativo global para `admin_total`, sujeto a la regla actual de una sola comunidad activa por usuario
- carril de onboarding para primer ingreso sin comunidad

La creación multi-comunidad aún no está implementada.

---

# 7. Sistema híbrido de roles

## Implementación oficial

La lógica híbrida vive principalmente en:

- `backend/src/utils/comunidadRoles.js`
- `backend/src/utils/buildAuthUserResponse.js`

## Responsabilidades de `comunidadRoles`

- resolver membresía activa
- resolver owner
- producir rol local efectivo
- soportar fallback legacy
- sincronizar usuario y membresía principal
- crear membresías faltantes de compatibilidad

## Responsabilidades de `buildAuthUserResponse`

- hidratar comunidad actual
- calcular `rol_comunidad`
- calcular `is_owner`
- calcular `can_manage_comunidad`
- devolver snapshot autenticado consistente para frontend

## Decisión oficial

Para autorización local:

- la combinación `owner_user_id + comunidad_miembros` es la referencia real
- `users.rol` ya no debe considerarse suficiente por sí solo

---

# 8. Fase C

## Estado

- `COMPLETADA`

## Cierre funcional validado

- reducción de dependencia directa del frontend sobre `user.rol` para permisos locales
- sesión frontend rehidratada desde backend
- corrección de stale session mediante `refreshAuthSession`
- `UserContext` normaliza `rol_global`, `rol_comunidad`, `is_owner`, `can_manage_comunidad`
- `Header` y `App.js` consumen permisos derivados del usuario autenticado actualizado
- `Interacciones` usa polling con foco/visibilidad y relectura del backend
- `auth/refresh` recompone el estado autenticado real desde PostgreSQL

Nota histórica:

- en Fase C, `auth/refresh` todavía describía el refresh legacy basado en JWT
- desde Fase 1D, el refresh moderno productivo es `POST /api/auth/refresh` con
  cookie HttpOnly y `auth_sessions`

## Resultado arquitectónico

- backend consolidado como fuente de verdad
- frontend dejó de ser autoridad sobre permisos locales
- cambios de rol/comunidad se reflejan sin exigir relogin duro en cada caso

## Requisito correcto de la Fase 4C

**Objetivo de las invitaciones en la Fase 4C:** facilitar la incorporación inicial de personas nuevas a una comunidad específica, evitando que tengan que buscarla manualmente durante el onboarding.

En la fase actual, cada usuario solamente puede crear o pertenecer a una comunidad activa. Una invitación sólo puede ser aceptada por un usuario sin comunidad asignada, sin membresías activas y sin comunidades propias.

La participación, creación o administración de varias comunidades por un mismo usuario queda reservada para una fase futura, cuando COMUVA disponga de selección de comunidad activa y toda la aplicación esté preparada para operar con múltiples contextos comunitarios.

El backend y PostgreSQL RDS deben aplicar esta restricción como fuente de verdad. El frontend únicamente debe representar la decisión devuelta por el backend y no debe crear, inferir ni asignar membresías o comunidades manualmente.

Cualquier implementación que haya permitido crear una membresía secundaria durante la Fase 4C fue una omisión del requisito original y debe corregirse. La estructura relacional y los campos de comunidad principal se conservan como historial técnico y preparación para la capacidad futura, no como habilitación multi-comunidad actual.

---

# 9. Fase D

## Estado

- `COMPLETADA`

## Cierre funcional validado

- introducción de `owner_user_id` en `comunidades`
- owner efectivo documentado y utilizado en middlewares/controladores
- owner tratado como `admin_basic` local efectivo para gestión local
- migración SQL de `owner_user_id` aplicada
- migración de `rol_global` aplicada
- tabla `comunidad_miembros` creada y poblada
- migración para `moderador` aplicada
- migración de consistencia owner/admin_basic aplicada
- `buildAuthUserResponse` consolidado
- `comunidadRoles` consolidado
- `MiembrosComunidadPanel` alineado al modelo híbrido

## Resultado arquitectónico

- ownership persistido en base de datos
- permisos locales separados de permisos globales
- panel de miembros con owner visible como rol estructural
- backend capaz de exponer estado autenticado coherente para UI

---

# 9A. Fase 1D

## Estado

- `CERRADA Y VALIDADA EN PRODUCCIÓN`

## Cierre funcional validado

- persistent auth sessions en `auth_sessions`
- Google direct callback
- refresh cookie HttpOnly `comuva_refresh`
- redirect limpio a `/seinscrever`
- no JWT en URL
- access JWT corto obtenido posteriormente por refresh
- retorno correcto a invitación
- membership creada sólo después de aceptación explícita
- logout/revocación y persistencia validados
- cero loops/races/5xx relevantes en validación productiva

## Resultado arquitectónico

- autenticación moderna separada entre refresh credential server-side y access JWT
  corto
- compatibilidad legacy conservada por `GET /api/auth/refresh` y
  `POST /api/auth/session/migrate`
- Web Push y Service Worker permanecen separados de la sesión autenticada

---

# 10. Estado actual validado

Validado contra código actual:

- `admin_total` funciona
- `owner` funciona
- `admin_basic` funciona
- `moderador` funciona
- `miembro` funciona
- moderación funciona
- gestión de miembros funciona
- interacciones globales funcionan
- respuestas cross-community funcionan

## Alcance de esta validación

La validación anterior aplica a:

- autenticación y refresh
- comunidades
- membresías
- owner
- interacciones
- respuestas
- paneles de comunidad y miembros
- infraestructura PWA base
- detección PWA en frontend
- onboarding post-aceptación desplegado en producción

No implica que `grupos`, `tareas` y `reportes` ya estén completamente alineados al sistema híbrido.
No implica que la instalación Android/Chrome esté validada, porque el E2E real no
mostró el CTA `Instalar COMUVA`.

---

# 11. Módulos y estado de alineación

## `auth`

- estado: `COMPLETADO`
- uso: `EN USO`
- observación: `POST /api/auth/refresh` rota refresh credential por cookie HttpOnly,
  recompone el usuario desde PostgreSQL y emite access JWT corto
- compatibilidad: `GET /api/auth/refresh` legacy Bearer sigue disponible
- migración: `POST /api/auth/session/migrate` sigue disponible como bridge temporal

## `comunidades`

- estado: `COMPLETADO`
- uso: `EN USO`
- observación: ownership y membresía local ya integrados

## `miembros de comunidad`

- estado: `COMPLETADO`
- uso: `EN USO`
- observación: UI y backend alineados a owner/admin_basic/moderador/miembro

## `interacciones`

- estado: `COMPLETADO`
- uso: `EN USO`
- observación: usa `verificarRolComunidad`, soporta visibilidad global y moderación contextual

## `respuestas`

- estado: `COMPLETADO`
- uso: `EN USO`
- observación: soporta respuesta cross-community para interacciones globales y moderación contextual

## `pwa installation / onboarding`

- estado: `PARCIALMENTE IMPLEMENTADO`
- uso: `DESPLEGADO EN PRODUCCIÓN`
- observación: `PwaInstallContext` implementa detección standalone/iOS,
  `beforeinstallprompt`, deferred prompt, `appinstalled`, estados de instalación y
  `promptInstall()`
- observación: `Convite` ofrece instalación post-aceptación sólo para `new-member`
  cuando el estado PWA lo permite
- pendiente: diagnóstico Android/Chrome por ausencia del CTA `Instalar COMUVA` en
  E2E real
- restricción: instalación PWA no autentica, no crea membership, no solicita Push y
  no bloquea entrada a comunidad

## `grupos`

- estado: `PENDIENTE`
- uso: `EN USO`
- observación: mezcla ruta híbrida con lógica legacy basada en `req.user.rol`

## `tareas`

- estado: `PENDIENTE`
- uso: `EN USO`
- observación: usa middleware híbrido pero mantiene chequeos internos legacy con `req.user.rol`

## `reportes`

- estado: `PENDIENTE`
- uso: `EN USO`
- observación: middleware ya consulta `tieneRolComunidad`, pero falta auditoría integral del módulo

---

# 12. Decisiones oficiales vigentes

## `COMPLETADO`

- backend como autoridad final
- PostgreSQL como persistencia oficial
- frontend como vista sincronizada
- ownership estructural separado de rol global
- membresía local separada de rol global
- refresh cookie HttpOnly + `auth_sessions` como persistencia moderna de sesión
- access JWT corto en memoria como credencial de request
- Google callback limpio sin JWT en query string
- infraestructura de detección PWA implementada
- onboarding post-aceptación con oferta PWA secundaria implementado y desplegado

## `DEPRECADO`

- asumir que `users.rol` define por sí solo permisos locales
- asumir que `localStorage.user` es verdad persistente
- acoplar UI de permisos solo a datos decodificados del JWT sin refresh

## `PENDIENTE`

- política oficial de multi-comunidad
- normalización total de módulos legacy
- sustitución del polling por tiempo real
- hardening de OAuth `state`, account linking, selección explícita de cuenta Google,
  PushSubscription logout, BFCache UX, rate limiting de invitaciones y alineación de
  códigos `AUTH_*`
- diagnóstico de ausencia del CTA `Instalar COMUVA` en Android/Chrome
- validación E2E de instalación y restauración de sesión PWA por plataforma

---

# 13. Roadmap

## Fase 1E

Estado:

- `PARCIALMENTE IMPLEMENTADA Y DESPLEGADA`
- `NO CERRADA`

Nota:

- Fase 1E es la continuación inmediata del track 1 de autenticación/onboarding,
  dedicada a PWA installation/onboarding
- no renumera ni reemplaza la Fase E histórica del roadmap

Objetivo:

- PWA installation / onboarding
- integrar una experiencia de instalación después de incorporación exitosa
- ofrecer instalación sin bloquear uso web normal ni entrada a la comunidad

Implementado:

- auditoría PWA inicial completada
- `PwaInstallContext` con detección standalone/iOS/iPadOS
- `beforeinstallprompt`
- deferred prompt en memoria
- `appinstalled`
- estados `installed`, `installable`, `prompting`, `manualInstall`, `dismissed`,
  `unavailable`
- onboarding post-aceptación para `new-member`
- fallback manual iOS/iPadOS
- deploy producción del frontend en `c0aba833b261d9ec02327d85ee7b1824124cf15c`

Pendiente:

- Android/Chrome
- diagnóstico de `beforeinstallprompt` en producción
- desktop Chromium E2E
- iOS/Safari fallback manual E2E
- validación de PWA ya instalada
- validación de persistencia de sesión al abrir PWA instalada por plataforma
- no Play Store
- no instalación silenciosa
- no bloquear uso web normal

Estado E2E Android/Chrome:

- flujo convite -> Google -> aceptación -> membership -> refresh -> `Tudo certo!`
  -> `Entrar na comunidade` validado
- no apareció `Instalar COMUVA`
- causa raíz no determinada
- Fase 1E no debe marcarse cerrada hasta concluir diagnóstico y validación

## Fase E

Estado:

- `PENDIENTE`

Objetivo:

- auditoría de `Grupos`
- auditoría de `Tareas`
- auditoría de `Reportes`
- validación de alineación completa con el sistema híbrido

## Fase F

Estado:

- `PENDIENTE`

Objetivo:

- creación multi-comunidad

Definir:

- quién puede crear múltiples comunidades
- límites por usuario
- ownership por comunidad
- reglas de negocio de membresía principal
- convivencia con `owner_user_id`

## Fase G

Estado:

- `PENDIENTE`

Objetivo:

- notificaciones en tiempo real

Evaluar:

- WebSocket
- SSE
- eliminación futura de polling

## Fase H

Estado:

- `PENDIENTE`

Objetivo:

- preparación para escalabilidad

Evaluar:

- AWS
- RDS
- caché
- observabilidad
- métricas

---

# 14. Conclusión oficial

Al cierre de Fase 1D y actualización documental Fase 1E.4B, COMUVA ya tiene un
núcleo arquitectónico estable:

- autenticación persistente con `auth_sessions`
- refresh cookie HttpOnly y access JWT corto en memoria
- backend como fuente de verdad
- ownership persistido
- membresías locales
- sistema híbrido de roles operativo
- moderación contextual funcional
- infraestructura PWA base
- detección PWA en frontend
- onboarding post-aceptación con oferta de instalación secundaria

El flujo Google directo quedó validado en producción sin JWT en URL, con redirect
limpio, sesión persistente, retorno correcto a invitación y aceptación explícita antes
de crear membresía.

Fase 1E ya implementó y desplegó infraestructura de detección PWA y onboarding
post-aceptación. Sin embargo, no está cerrada: el E2E real Android/Chrome validó el
flujo de convite, Google, aceptación, membership, refresh y `Tudo certo!`, pero no
mostró el CTA `Instalar COMUVA`. La prioridad inmediata es `FASE 1E.5A —
DIAGNÓSTICO ANDROID BEFOREINSTALLPROMPT`, sin asumir causa raíz ni declarar validada
la instalación Android.

Las prioridades históricas de alinear `grupos`, `tareas` y `reportes`, definir
multi-comunidad y sustituir polling por tiempo real siguen pendientes.
