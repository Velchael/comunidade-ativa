# COMUVA Fase C: Matriz de Permisos

Arquitectura híbrida:

- `users.rol` / `users.rol_global`: dimensión global
- `comunidad_miembros.rol_comunidad`: dimensión local
- `admin_total`: global
- `admin_basic`, `moderador`, `miembro`: locales
- backend: source of truth

## Matriz

| Pantalla / capacidad | miembro | moderador | admin_basic | admin_total |
| --- | --- | --- | --- | --- |
| Navegación base: Interações | Sí | Sí | Sí | Sí |
| Navegación base: Agenda | Sí | Sí | Sí | Sí |
| Navegación base: Grupos | Sí | Sí | Sí | Sí |
| Explorar | Sí | Sí | Sí | Sí |
| Responder publicaciones | Sí | Sí | Sí | Sí |
| Herramientas de moderación en interacciones | No | Sí | Sí | Sí |
| Panel global Usuários | No | No | No | Sí |
| Panel Comunidade | No | No | Sí | Sí |
| Ver miembros de comunidad | No | No | Sí | Sí |
| Gestionar roles locales | No | No | Sí | Sí |
| Configuración global | No | No | No | Sí |

## Notas

- `moderador` no ve panel de miembros ni gestión de roles mientras backend mantenga esa política.
- `admin_total` conserva herramientas globales y también puede operar sobre paneles comunitarios.
- `admin_basic` global no implica privilegios locales automáticos: la UI debe mirar `rol_comunidad`, `is_owner` y `can_manage_comunidad`.
- La moderación de interacciones sigue siendo contextual a la comunidad origen.
