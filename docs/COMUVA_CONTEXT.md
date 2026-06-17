# COMUVA_CONTEXT.md

# COMUVA — Contexto Maestro del Proyecto

## 1. Visión General del Proyecto

COMUVA es una plataforma híbrida de comunidades colaborativas orientada a:

* ayuda comunitaria
* interacción social contextual
* networking local/global
* economía solidaria
* colaboración entre comunidades

La arquitectura busca combinar:

* comunidades locales independientes
* usuarios multi-comunidad
* interacciones globales
* moderación contextual
* ownership distribuido

Filosofía principal:

```txt
1 comunidad = muchos usuarios
1 usuario = muchas comunidades
muchas comunidades = ecosistema conectado
```

COMUVA NO está diseñada como comunidades completamente aisladas.

El objetivo es un modelo híbrido:

```txt
visibilidad global
+
ownership local
+
moderación contextual
```

---

# 2. Stack Tecnológico

## Frontend

* React
* React Router
* Axios
* Bootstrap / React-Bootstrap
* LocalStorage para persistencia ligera
* JWT auth

## Backend

* Node.js
* Express
* Sequelize ORM
* PostgreSQL
* JWT Authentication

## Base de Datos

* PostgreSQL
* Sequelize migrations

---

# 3. Arquitectura General

## Frontend

Ruta principal:

```txt
frontend/src/
```

Estructura importante:

```txt
Screens/
Components/
contexts/
services/
utils/
```

Pantallas principales:

* Interacciones.js
* MiembrosComunidadPanel.js
* ComunidadesPanel.js
* ConfiguracionPanel.js

Contexto principal:

```txt
frontend/src/contexts/UserContext.js
```

---

## Backend

Ruta principal:

```txt
backend/src/
```

Estructura:

```txt
controllers/
routes/
middleware/
models/
utils/
migrations/
```

---

# 4. Sistema de Autenticación JWT

## Flujo actual

1. Usuario login/register
2. Backend genera JWT
3. Frontend guarda:

   * token
   * user
4. UserContext hidrata sesión desde localStorage

## JWT contiene típicamente

```json
{
  "id": 1,
  "email": "...",
  "rol": "admin_total",
  "rol_global": "admin_total",
  "username": "Velchael",
  "comunidad_id": 1
}
```

## Middleware principal

```txt
backend/src/middleware/authMiddleware.js
```

Exporta:

```js
verificarToken
```

---

# 5. Sistema de Roles Globales

## Roles globales actuales

```txt
admin_total
admin_basic (legacy/global parcial)
miembro
```

## Fuente real

Tabla:

```txt
users
```

Campos:

```txt
rol
rol_global
```

Actualmente ambos siguen coexistiendo por compatibilidad histórica.

## admin_total global

Tiene autoridad transversal sobre TODAS las comunidades.

Puede:

* moderar cualquier comunidad
* listar miembros
* cambiar roles locales
* moderar interacciones
* moderar respuestas

Aunque NO tenga rol local administrativo.

---

# 6. Sistema de Roles Locales por Comunidad

## Tabla principal

```txt
comunidad_miembros
```

Campos relevantes:

```txt
user_id
comunidad_id
rol_comunidad
estado
es_principal
```

## Roles locales actuales

```txt
admin_total
admin_basic
moderador
miembro
```

## Filosofía

Los roles locales NO reemplazan roles globales.

Son dimensiones separadas.

Ejemplo:

```txt
rol_global = admin_total
rol_comunidad = miembro
```

Eso es válido y esperado.

---

# 7. Relación Usuario ↔ Comunidad

Modelo actual:

```txt
muchos a muchos
```

Tabla pivote:

```txt
comunidad_miembros
```

Un usuario puede:

* pertenecer a múltiples comunidades
* tener distintos roles locales
* tener comunidad principal
* participar globalmente

---

# 8. Middlewares Importantes

## verificarToken

Archivo:

```txt
backend/src/middleware/authMiddleware.js
```

Responsabilidad:

* validar JWT
* hidratar req.user

---

## verificarRolComunidad

Archivo:

```txt
backend/src/middleware/verificarRolComunidad.js
```

Middleware CENTRAL del sistema multi-comunidad.

Responsabilidad:

* resolver membresía activa
* validar roles locales
* permitir admin_total global

Produce:

```js
req.comunidadAuth
```

Con:

```js
{
  comunidad_id,
  rol_comunidad,
  source
}
```

---

## ownershipComunidad

Archivo:

```txt
backend/src/middleware/ownershipComunidad.js
```

Usado para:

* editar comunidad
* eliminar comunidad

Regla:

```txt
owner_user_id OR admin_total global
```

---

## allowListarMiembrosComunidad

Middleware específico creado en Fase 4.6.1.

Permite:

* admin_total global
* owner_user_id
* admin_basic local

---

## allowGestionarRolesComunidad

Usado en Fase 4.6.3.

Permite:

* admin_total global
* admin_basic local

Bloquea:

* autoedición
* owner
* admin_total global target

---

# 9. Flujo Actual de Permisos

## Arquitectura correcta actual

```txt
ownership/moderación = comunidad origen
```

## Reglas importantes

### Interacciones globales

Pueden:

* verse globalmente
* recibir respuestas cross-community

NO pueden:

* ser moderadas por cualquier comunidad

## Moderación

Siempre depende de:

```txt
interaccion.comunidad_id
```

NO de la comunidad del actor.

---

# 10. Interacciones (Fase 4.6.4-C1)

## Estados actuales

```txt
abierto
cerrado
en_proceso
oculto
```

## PATCH implementado

```txt
PATCH /api/interacciones/:id/estado
```

## Moderadores permitidos

```txt
admin_total global
admin_basic local
moderador local
```

## miembro simple

NO puede moderar.

---

# 11. Filosofía Correcta del Sistema

## Mantener

✅ interacciones globales
✅ respuestas cross-community
✅ usuarios multi-comunidad

## NO hacer

❌ comunidades totalmente cerradas
❌ moderación global indiscriminada

---

# 12. Decisiones Técnicas Tomadas

## Decisión crítica

NO sincronizar automáticamente:

```txt
rol_global -> rol_comunidad
```

Porque son dimensiones distintas.

---

## Decisión de moderación

La moderación pertenece siempre a:

```txt
comunidad origen
```

---

## Decisión de UI

Frontend NO debe inferir permisos desde localStorage.

Debe consumir permisos reales desde backend.

---

## Decisión de C1

GET interacciones ahora devuelve:

```json
{
  "items": [...],
  "auth": {
    "rol_comunidad": "...",
    "can_moderate_interacciones": true
  }
}
```

---

# 13. Problemas ya corregidos

## ✔ Listado seguro de miembros

Fase 4.6.1 completada.

---

## ✔ Roles locales

Fase 4.6.3 completada.

Incluye:

* promover
* degradar
* moderador
* admin local

---

## ✔ Moderación de interacciones

Fase 4.6.4-C1 funcional.

Incluye:

* ocultar
* abrir
* cerrar
* permisos contextuales

---

## ✔ Protección admin_total

No editable localmente.

---

## ✔ Frontend consume permisos reales

Interacciones.js ya usa:

```txt
auth.can_moderate_interacciones
```

---

# 14. Problemas Pendientes

## C2 — Moderación de respuestas

Pendiente.

Debe implementar:

```txt
PATCH /api/respuestas/:id/estado
```

Estados previstos:

```txt
activa
oculta
```

---

## Riesgo detectado

La tabla respuestas podría NO tener columna:

```txt
estado
```

Debe verificarse antes de implementar C2.

---

## UserContext stale

Problema parcial:

roles locales pueden quedar stale en localStorage.

Mitigado parcialmente porque frontend ya consume permisos reales desde backend.

---

# 15. Riesgos Conocidos

## Riesgo 1

Uso simultáneo de:

```txt
rol
rol_global
```

Aún existe por compatibilidad legacy.

---

## Riesgo 2

Algunas pantallas todavía muestran:

```txt
Rol comunidad
```

cuando realmente muestran rol global.

---

## Riesgo 3

Interacciones globales pueden crecer rápidamente.

En producción será necesario:

* rate limits
* reputación
* anti-spam
* auditoría
* observabilidad

---

# 16. Convenciones Actuales

## Backend

Controllers:

```txt
exports.nombreFuncion
```

Middleware:

```txt
req.comunidadAuth
req.user
```

---

## Frontend

Estado principal:

```js
const [lista, setLista]
```

Errores:

```js
estadoErrorGeneral
estadoErroresPorId
```

---

# 17. Archivos Más Importantes

## Backend

```txt
backend/src/controllers/comunidadesController.js
backend/src/controllers/interaccionesController.js
backend/src/controllers/respuestasController.js

backend/src/middleware/verificarRolComunidad.js
backend/src/middleware/allowGestionarRolesComunidad.js
backend/src/middleware/allowListarMiembrosComunidad.js

backend/src/utils/comunidadRoles.js

backend/src/models/ComunidadMiembro.js
backend/src/models/Interaccion.js
backend/src/models/Respuesta.js
```

---

## Frontend

```txt
frontend/src/Screens/Interacciones.js
frontend/src/Screens/MiembrosComunidadPanel.js
frontend/src/Screens/ComunidadesPanel.js
frontend/src/Screens/ConfiguracionPanel.js

frontend/src/contexts/UserContext.js
```

---

# 18. Estado Actual del Desarrollo

## Estado general

```txt
Fase 4.x avanzada
```

## Completado

* roles locales
* miembros
* moderadores
* moderación de interacciones
* permisos contextuales
* ownership contextual

## Próximo objetivo

```txt
Fase 4.6.4-C2
→ moderación de respuestas
```

---

# 19. Recomendación Arquitectónica Final

NO cerrar comunidades.

Mantener:

```txt
global visibility
+
local ownership
+
contextual moderation
```

Esa es la arquitectura correcta para COMUVA.

---

# 20. Recomendación para Próximos Chats/Codex

Antes de modificar cualquier flujo:

1. Revisar:

   * req.comunidadAuth
   * ownership real
   * comunidad origen
2. Nunca inferir permisos desde frontend solamente.
3. Preferir:

   * backend source of truth
4. Mantener separación:

   * rol_global
   * rol_comunidad
5. No romper interacciones globales cross-community.
6. Toda moderación debe resolverse desde:

   * recurso real
   * comunidad origen

FIN
