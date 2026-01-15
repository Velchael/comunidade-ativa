# Guía de Deploy - Comandos de Referencia

## Migraciones de Base de Datos

### Verificar Estado de Migraciones
```bash
docker exec comunidade-ativa-backend-1 npx sequelize-cli db:migrate:status --env development
```

### Ejecutar Migraciones Pendientes
```bash
docker exec comunidade-ativa-backend-1 npx sequelize-cli db:migrate --env development
```

### Verificar Tablas en la Base de Datos
```bash
docker exec comunidade-ativa-db-1 psql -U postgres -d comunidad -c "\dt"
```

### Revertir Última Migración (si necesario)
```bash
docker exec comunidade-ativa-backend-1 npx sequelize-cli db:migrate:undo --env development
```

## Diagnóstico CSP (Content Security Policy)

### Verificar Headers del Frontend
```bash
curl -I https://comunidad-ativa.reddevida.com.br
```

### Verificar Headers del Backend Directamente
```bash
curl -I http://localhost:3000/api/versao
```

### Verificar Configuración de Nginx
```bash
docker exec comunidade-ativa-frontend-1 cat /etc/nginx/conf.d/default.conf
```

## Gestión de Contenedores

### Reiniciar Servicios
```bash
# Reiniciar backend
docker restart comunidade-ativa-backend-1

# Reiniciar frontend
docker restart comunidade-ativa-frontend-1

# Reiniciar base de datos
docker restart comunidade-ativa-db-1
```

### Verificar Estado de Contenedores
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Troubleshooting Común

- **Error 500 en login Google:** Verificar que las migraciones estén ejecutadas
- **CSP restrictivo:** Nginx debe usar `proxy_hide_header Content-Security-Policy`
- **Tablas no existen:** Ejecutar migraciones con los comandos de arriba
