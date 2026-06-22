# COMUVA_CONTEXT.md

# COMUVA — Contexto Maestro del Proyecto

## Estado del documento

- Alcance: cierre de Fase D
- Estado: `COMPLETADO`
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
- sesión frontend sincronizada periódicamente con el backend

## Estado por área

### `COMPLETADO`

- autenticación JWT con `login`, `me` y `refresh`
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
- comunidad principal actual
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
- comunidad principal del usuario

Estado:

- `EN USO`
- `SOURCE OF TRUTH` para permisos locales, junto con `owner_user_id`

## 2.2 Relaciones oficiales

### `users` -> `comunidades`

- `users.comunidad_id` apunta a la comunidad principal actual del usuario
- esta relación sigue existiendo por compatibilidad y navegación operativa

### `users` <-> `comunidades` vía `comunidad_miembros`

- relación muchos a muchos
- representa la membresía real
- permite evolución futura a multi-comunidad

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

- solo `admin_total`

No puede crear:

- owner
- admin local
- moderador
- miembro

Efectos:

- crea comunidad
- asigna `owner_user_id`
- crea o corrige membresía del creador como `admin_basic` local

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

- carril administrativo global para `admin_total`
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

## Resultado arquitectónico

- backend consolidado como fuente de verdad
- frontend dejó de ser autoridad sobre permisos locales
- cambios de rol/comunidad se reflejan sin exigir relogin duro en cada caso

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

No implica que `grupos`, `tareas` y `reportes` ya estén completamente alineados al sistema híbrido.

---

# 11. Módulos y estado de alineación

## `auth`

- estado: `COMPLETADO`
- uso: `EN USO`
- observación: backend recompone sesión desde DB

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
- refresh de sesión como mecanismo de corrección de estado

## `DEPRECADO`

- asumir que `users.rol` define por sí solo permisos locales
- asumir que `localStorage.user` es verdad persistente
- acoplar UI de permisos solo a datos decodificados del JWT sin refresh

## `PENDIENTE`

- política oficial de multi-comunidad
- normalización total de módulos legacy
- sustitución del polling por tiempo real

---

# 13. Roadmap

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

Al cierre de Fase D, COMUVA ya tiene un núcleo arquitectónico estable:

- autenticación con refresh
- backend como fuente de verdad
- ownership persistido
- membresías locales
- sistema híbrido de roles operativo
- moderación contextual funcional

La siguiente prioridad no es redefinir lo ya resuelto, sino alinear `grupos`, `tareas` y `reportes` al mismo estándar antes de abrir multi-comunidad y tiempo real.
