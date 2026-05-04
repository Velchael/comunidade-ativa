# 📚 Documentación Técnica - Proyecto Comunidad

## 📦 Estructura del Proyecto (Refactorizada)

```
backend/
├── config/
│   └── config.js              # ✅ Usado por Sequelize CLI (migraciones)
├── migrations/                # Migraciones de base de datos
├── models/                    # ⚠️ LEGACY - No usado en runtime
│   └── index.js              # Generado por Sequelize CLI (mantener por compatibilidad)
├── src/
│   ├── config/
│   │   └── passport.js       # Configuración de autenticación
│   ├── controllers/          # Lógica de negocio
        taskController.js
        usersController.js
│   ├── db/
│   │   └── index.js          # ✅ INSTANCIA ÚNICA DE SEQUELIZE
│   ├── middleware/           # Middlewares de Express
│   ├── models/
│   │   ├── index.js          # ✅ Cargador de modelos (usa instancia única)
│   │   ├── User.js           # Modelo de User
│   │   ├── Task.js           # Modelo de Tarea
│   │   ├── Comunidad.js      # Modelo de Comunidad
│   │   ├── GrupoActivo.js    # Modelo de Grupo Activo
│   │   └── Reporte.js        # Modelo de Reporte
│   ├── routes/               # Rutas de la API
│   │   ├── authRoutes.js          
│   │   ├── comunidades.js          
│   │   ├── gruporeporteRoutes.js     
│   │   ├── grupos.js   
│   │   └── index.js       
            reportesRoutes.js
            tasks.js
            users.js       
│   └── utils/                # Utilidades
├── .env.production           # Variables de entorno (producción)
├── app.js                    # Configuración de Express
├── server.js                 # Punto de entrada
├── Dockerfile.prod           # Dockerfile para producción
└── package.json
```

---

## 🔌 Flujo de Conexión a la Base de Datos

### Arquitectura Unificada (Post-Refactorización)

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE_URL                              │
│  postgresql://user:pass@host:5432/db                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              backend/src/db/index.js                         │
│  ✅ INSTANCIA ÚNICA DE SEQUELIZE                            │
│  - Configuración SSL para RDS                                │
│  - Pool de conexiones                                        │
│  - Retry logic                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
┌──────────────────┐                  ┌──────────────────┐
│   server.js      │                  │ src/models/      │
│                  │                  │   index.js       │
│ sequelize        │                  │                  │
│  .authenticate() │                  │ Importa          │
│                  │                  │ sequelize        │
│ Health check     │                  │ desde ../db      │
└──────────────────┘                  └──────────────────┘
                                                ↓
                                      ┌──────────────────┐
                                      │  Modelos         │
                                      │  - User.js       │
                                      │  - Task.js       │
                                      │  - Comunidad.js  │
                                      │  - etc.          │
                                      └──────────────────┘
                                                ↓
                                      ┌──────────────────┐
                                      │  Controllers     │
                                      │  & Routes        │
                                      └──────────────────┘
```

### Flujo de Migraciones (Independiente)

```
┌─────────────────────────────────────────────────────────────┐
│              npx sequelize db:migrate                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              backend/config/config.js                        │
│  ✅ Configuración para Sequelize CLI                        │
│  - Lee DATABASE_URL                                          │
│  - Configuración SSL para producción                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              backend/migrations/*.js                         │
│  Ejecuta migraciones en orden                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 Por Qué Se Unificó la Capa de Base de Datos

### ❌ Problema Anterior

**Duplicación de instancias de Sequelize:**

1. `backend/src/db/index.js` creaba una instancia
2. `backend/src/models/index.js` creaba OTRA instancia
3. Ambas con configuraciones ligeramente diferentes
4. Consumo innecesario de conexiones al pool
5. Posibles inconsistencias en configuración SSL

**Resultado:** Dos pools de conexiones, mayor consumo de recursos, complejidad innecesaria.

### ✅ Solución Implementada

**Una sola fuente de verdad:**

- `backend/src/db/index.js` es la ÚNICA instancia de Sequelize
- `backend/src/models/index.js` IMPORTA esa instancia
- Todos los modelos usan la misma conexión
- Un solo pool de conexiones
- Configuración SSL centralizada

**Beneficios:**
- ✅ Menor consumo de recursos
- ✅ Configuración centralizada
- ✅ Más fácil de debuggear
- ✅ Código más limpio y mantenible
- ✅ Evita race conditions en la conexión

---

## ⚠️ Archivos Eliminados y Por Qué

### ❌ `backend/src/config/config.js` - ELIMINADO

**Razón:** 
- Era una configuración legacy que usaba variables individuales (PG_USER, PG_PASSWORD, etc.)
- No se usaba en producción (solo DATABASE_URL)
- Causaba confusión con `backend/config/config.js`
- No aportaba valor al proyecto

**Impacto:** Ninguno. No se usaba en runtime.

### ⚠️ `backend/models/index.js` - MANTENIDO (pero no usado)

**Razón para mantener:**
- Generado automáticamente por Sequelize CLI
- Podría ser referenciado por comandos de CLI
- No causa problemas al existir
- Documentado como LEGACY

**Nota:** Si en el futuro se confirma que no se usa, puede eliminarse.

---

## 🚀 Cómo Ejecutar Migraciones

### Desarrollo Local

```bash
# Asegurarse de tener DATABASE_URL en .env
cd backend

# Crear una nueva migración
npx sequelize-cli migration:generate --name nombre-de-la-migracion

# Ejecutar migraciones pendientes
npx sequelize-cli db:migrate

# Revertir última migración
npx sequelize-cli db:migrate:undo

# Ver estado de migraciones
npx sequelize-cli db:migrate:status
```

### Producción (Docker)

```bash
# Opción 1: Ejecutar dentro del container
docker exec -it comunidad-backend npx sequelize-cli db:migrate

# Opción 2: Ejecutar antes de levantar el servicio
docker-compose -f docker-compose.prod.yml run --rm backend npx sequelize-cli db:migrate
```

### Configuración de Migraciones

El archivo `backend/config/config.js` es usado exclusivamente por Sequelize CLI:

```javascript
module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
```

**Importante:** Este archivo NO se usa en runtime, solo para comandos CLI.

---

## 🐳 Flujo Docker (Build, Up, Deploy)

### Desarrollo Local

```bash
# Build de la imagen
docker-compose build backend

# Levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f backend

# Reiniciar servicio
docker-compose restart backend

# Detener todo
docker-compose down
```

### Producción (EC2)

```bash
# Build de la imagen de producción
docker compose -f docker-compose.prod.yml build backend

# Levantar servicios
docker compose -f docker-compose.prod.yml up -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f backend

# Reiniciar solo backend
docker compose -f docker-compose.prod.yml restart backend

# Rebuild y restart (después de cambios en código)
docker compose -f docker-compose.prod.yml build backend && \
docker compose -f docker-compose.prod.yml up -d backend
```

### Variables de Ambiente Requeridas

**Archivo: `backend/.env.production`**

```bash
# Base de datos
DATABASE_URL=postgresql://user:password@host:5432/dbname
NODE_ENV=production
PORT=3001

# Autenticación
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=your-session-secret

# Frontend (CORS)
FRONTEND_URL=https://your-domain.com
```

**⚠️ IMPORTANTE:** 
- NO incluir `?sslmode=require` en DATABASE_URL
- El SSL se maneja en el código (dialectOptions)

---

## 🔐 Consideraciones de SSL con AWS RDS

### Configuración Actual

```javascript
// backend/src/db/index.js
const isProduction = process.env.NODE_ENV === "production";

const sequelize = new Sequelize(dbUrl, {
  dialect: "postgres",
  dialectOptions: isProduction
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,  // ← Clave para RDS
        },
      }
    : {},
});
```

### Por Qué `rejectUnauthorized: false`

**Problema:** AWS RDS usa certificados auto-firmados que Node.js rechaza por defecto.

**Solución:** `rejectUnauthorized: false` permite conexiones SSL sin validar el certificado.

**¿Es seguro?**
- ✅ SÍ para RDS: La conexión sigue siendo encriptada
- ✅ RDS está dentro de tu VPC (no es público)
- ✅ Security Groups controlan el acceso
- ❌ NO usar en conexiones a bases de datos públicas

### Alternativa Más Segura (Opcional)

Si quieres validar el certificado de RDS:

```javascript
const fs = require('fs');

dialectOptions: {
  ssl: {
    require: true,
    ca: fs.readFileSync('/path/to/rds-ca-certificate.pem').toString(),
  },
}
```

Descargar certificado: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html

---

## 🧪 Cómo Debuggear Problemas de Conexión

### 1. Verificar Variables de Ambiente

```bash
# Dentro del container
docker exec comunidad-backend printenv | grep DATABASE_URL
docker exec comunidad-backend printenv | grep NODE_ENV
```

**Esperado:**
```
DATABASE_URL=postgresql://user:pass@host:5432/db
NODE_ENV=production
```

### 2. Test de Conectividad TCP

```bash
# Desde EC2 (fuera del container)
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/your-rds-endpoint/5432' && \
echo "✅ Puerto 5432 ABIERTO" || echo "❌ Puerto 5432 CERRADO"
```

### 3. Test con psql

```bash
# Instalar psql en el container
docker exec comunidad-backend apt-get update && \
docker exec comunidad-backend apt-get install -y postgresql-client

# Conectar
docker exec comunidad-backend bash -c \
'PGPASSWORD="your-password" psql -h your-rds-endpoint -U postgres -d comunidad -c "SELECT version();"'
```

### 4. Test con Node.js (Sequelize)

```bash
docker exec comunidad-backend node -e "
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});
sequelize.authenticate()
  .then(() => console.log('✅ CONEXIÓN EXITOSA'))
  .catch(err => console.error('❌ ERROR:', err.message));
"
```

### 5. Verificar Security Groups

```bash
# Obtener Security Group de EC2
aws ec2 describe-instances \
  --instance-ids $(curl -s http://169.254.169.254/latest/meta-data/instance-id) \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' \
  --output text

# Obtener Security Group de RDS
aws rds describe-db-instances \
  --db-instance-identifier your-db-identifier \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text

# Verificar reglas inbound del RDS
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxx \
  --query 'SecurityGroups[0].IpPermissions'
```

**Debe existir regla:**
- Puerto: 5432
- Source: Security Group de EC2 o CIDR de la VPC

### 6. Logs de la Aplicación

```bash
# Ver logs en tiempo real
docker logs -f comunidad-backend

# Ver últimas 50 líneas
docker logs comunidad-backend --tail 50

# Buscar errores específicos
docker logs comunidad-backend 2>&1 | grep -i "error\|timeout\|refused"
```

### 7. Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `ETIMEDOUT` | Security Group bloqueando | Verificar reglas inbound del RDS |
| `ECONNREFUSED` | RDS no está corriendo o endpoint incorrecto | Verificar estado del RDS |
| `self-signed certificate` | SSL mal configurado | Agregar `rejectUnauthorized: false` |
| `password authentication failed` | Credenciales incorrectas | Verificar DATABASE_URL |
| `database "X" does not exist` | Base de datos no creada | Crear base de datos en RDS |
| `too many connections` | Pool agotado | Reducir `pool.max` o aumentar `max_connections` en RDS |

---

## 📊 Arquitectura AWS

### Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    EC2 Instance                              │
│  - Security Group: comunidad-dev (sg-03c0ec5e219e2d06c)     │
│  - Docker Compose ejecutando:                                │
│    • comunidad-backend (puerto 3001)                         │
│    • comunidad-frontend (puerto 3000)                        │
│    • nginx-proxy (puertos 80/443)                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (Conexión SSL)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    RDS PostgreSQL                            │
│  - Endpoint: comunidad-db-restaurada.xxx.rds.amazonaws.com  │
│  - Security Group: comunidad-db (sg-018e1fa8f3b3ac33a)      │
│  - Puerto: 5432                                              │
│  - SSL: Requerido                                            │
└─────────────────────────────────────────────────────────────┘
```

### Security Groups

**comunidad-dev (EC2):**
- Inbound: 22 (SSH), 80 (HTTP), 443 (HTTPS)
- Outbound: All traffic

**comunidad-db (RDS):**
- Inbound: 5432 desde comunidad-dev
- Outbound: All traffic

---

## 🔄 Flujo de Deployment

### Manual (Actual)

```bash
# 1. SSH a EC2
ssh ec2-user@your-ec2-ip

# 2. Pull cambios
cd /home/ec2-user/comunidade-ativa
git pull origin main

# 3. Rebuild y restart
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend

# 4. Verificar
docker logs -f comunidad-backend
curl http://localhost:3001/api/tasks
```

### Con CI/CD (Futuro - CodePipeline)

```
GitHub Push → CodePipeline → CodeBuild → ECR → ECS Deploy
```

---

## 📝 Checklist de Deployment

Antes de hacer deploy a producción:

- [ ] Variables de ambiente configuradas en `.env.production`
- [ ] DATABASE_URL sin `?sslmode=require`
- [ ] NODE_ENV=production
- [ ] Security Groups configurados correctamente
- [ ] RDS accesible desde EC2
- [ ] Migraciones ejecutadas
- [ ] SSL configurado en código
- [ ] Build de Docker exitoso
- [ ] Health check funcionando (`/api/tasks` responde)
- [ ] Logs sin errores de conexión

---

## 🆘 Soporte y Troubleshooting

### Contactos
- **DevOps Lead:** [Tu nombre]
- **Repositorio:** https://github.com/henrylle/bia

### Recursos Útiles
- [Sequelize Documentation](https://sequelize.org/docs/v6/)
- [AWS RDS SSL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
- [Docker Compose](https://docs.docker.com/compose/)

### Logs Importantes

```bash
# Application logs
docker logs comunidad-backend

# System logs (EC2)
sudo journalctl -u docker -f

# RDS logs (desde AWS Console)
RDS → Databases → comunidad-db-restaurada → Logs & events
```

---

**Última actualización:** 2026-04-04  
**Versión:** 4.2.0  
**Autor:** DevOps Team
