# 🔍 DIAGNÓSTICO COMPLETO DE INFRAESTRUCTURA
**Fecha:** 2026-03-23  
**Proyecto:** comunidade-ativa  
**Región:** us-east-1

---

## ✅ RESUMEN EJECUTIVO

| Componente | Estado | Observaciones |
|------------|--------|---------------|
| EC2 Nueva | ✅ OK | Funcionando correctamente |
| RDS PostgreSQL | ✅ OK | Disponible y accesible |
| Conectividad EC2→RDS | ✅ OK | Puerto 5432 abierto |
| Conectividad Internet | ✅ OK | Salida funcionando |
| Docker | ✅ OK | Instalado y funcional |
| Docker Compose | ✅ OK | v2.23.3 instalado |
| Security Groups | ⚠️ ATENCIÓN | Requiere ajuste |
| Route 53 | ❌ CRÍTICO | Apunta a IP incorrecta |

---

## 🔍 1. VALIDACIÓN DE CONECTIVIDAD EC2

### Información de la Instancia
- **Instance ID:** i-0308ce1e41ebafc5b
- **Nombre:** comunidad-dev
- **Tipo:** t3.micro
- **Estado:** running ✅
- **IP Pública:** 184.73.41.143
- **IP Privada:** 172.31.88.165
- **VPC:** vpc-0f13c8443226940b0
- **Subnet:** subnet-0ac85fad383ec3089 (us-east-1a)
- **Security Group:** sg-03c0ec5e219e2d06c (comunidad-dev)
- **IAM Role:** role-acesso-ssm ✅

### Conectividad Validada
✅ **Internet Gateway:** igw-07b50df8fdb853116 (attached)  
✅ **Subnet pública:** MapPublicIpOnLaunch = true  
✅ **Salida a Internet:** Funcionando (probado con curl)  
✅ **Acceso a RDS:** Puerto 5432 abierto y accesible

---

## 🗄️ 2. VALIDACIÓN RDS POSTGRESQL

### Información de la Base de Datos
- **Identifier:** comunidad-db-restaurada
- **Clase:** db.t3.micro
- **Engine:** PostgreSQL 17.6
- **Estado:** available ✅
- **Endpoint:** comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com
- **Puerto:** 5432
- **VPC:** vpc-0f13c8443226940b0 ✅ (MISMA VPC QUE EC2)
- **Availability Zone:** us-east-1c
- **Security Group:** sg-018e1fa8f3b3ac33a (comunidad-db)
- **Publicly Accessible:** true
- **Storage Encrypted:** true ✅
- **Multi-AZ:** false

### Conectividad Validada
✅ **Prueba TCP:** Puerto 5432 responde correctamente desde EC2

---

## 🔐 3. ANÁLISIS DE SECURITY GROUPS

### Security Group: comunidad-dev (EC2)
**ID:** sg-03c0ec5e219e2d06c

#### Inbound Rules ✅
| Puerto | Protocolo | Source | Descripción |
|--------|-----------|--------|-------------|
| 80 | TCP | 0.0.0.0/0 | acesso publico HTTP frontend |
| 443 | TCP | 0.0.0.0/0 | acesso publico HTTPS |
| 3000 | TCP | 0.0.0.0/0 | liberado general |
| 3001 | TCP | 0.0.0.0/0 | liberado geral |

#### Outbound Rules ✅
| Protocolo | Destino |
|-----------|---------|
| All | 0.0.0.0/0 |

---

### Security Group: comunidad-db (RDS)
**ID:** sg-018e1fa8f3b3ac33a

#### Inbound Rules ⚠️
| Puerto | Source | Descripción |
|--------|--------|-------------|
| 5432 | sg-00cedfc193e2214ca | acesso do comunidad-web |
| 5432 | 172.31.16.0/20 | acesso da subnet us-east-1b |
| 5432 | 172.31.0.0/16 | acesso de toda VPC |

#### ⚠️ PROBLEMA DETECTADO
El Security Group del RDS tiene una regla que referencia **sg-00cedfc193e2214ca** (comunidad-web), pero tu EC2 actual usa **sg-03c0ec5e219e2d06c** (comunidad-dev).

**SOLUCIÓN:** La regla de CIDR `172.31.0.0/16` cubre toda la VPC, por lo que la conectividad funciona. Sin embargo, es recomendable:
1. Agregar una regla específica para `sg-03c0ec5e219e2d06c` (comunidad-dev)
2. Eliminar la regla obsoleta de `sg-00cedfc193e2214ca` si esa instancia ya no existe

---

## 🌐 4. VALIDACIÓN ROUTE 53

### ❌ PROBLEMA CRÍTICO DETECTADO

**Dominio:** comuva.com  
**Hosted Zone ID:** Z1035574TYP37YNTI879

#### Registros DNS Actuales
| Nombre | Tipo | TTL | Valor |
|--------|------|-----|-------|
| comuva.com | A | 300 | **34.204.68.182** ❌ |
| www.comuva.com | A | 300 | **34.204.68.182** ❌ |

#### 🚨 ACCIÓN REQUERIDA
El dominio apunta a **34.204.68.182** (probablemente la EC2 eliminada).  
Tu nueva EC2 tiene la IP **184.73.41.143**.

**DEBES ACTUALIZAR:**
- comuva.com → 184.73.41.143
- www.comuva.com → 184.73.41.143

⚠️ **RECOMENDACIÓN:** Considera usar una Elastic IP para evitar este problema en el futuro.

---

## 🐳 5. VALIDACIÓN DOCKER

### Instalación Verificada ✅
- **Docker:** v20.10.17 ✅
- **Docker Compose:** v2.23.3 ✅

### Permisos IAM ✅
La instancia tiene el role **role-acesso-ssm** que permite:
- Acceso a Systems Manager
- Potencialmente acceso a otros servicios AWS

---

## 📋 6. ACCIONES REQUERIDAS (PRIORIDAD)

### 🔴 CRÍTICO - Actualizar Route 53
```bash
# Comando para actualizar el registro DNS
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1035574TYP37YNTI879 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "comuva.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "184.73.41.143"}]
      }
    }]
  }'

# Actualizar www.comuva.com
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1035574TYP37YNTI879 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.comuva.com",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [{"Value": "184.73.41.143"}]
      }
    }]
  }'
```

### 🟡 RECOMENDADO - Ajustar Security Group de RDS
```bash
# Agregar regla para el nuevo Security Group
aws ec2 authorize-security-group-ingress \
  --group-id sg-018e1fa8f3b3ac33a \
  --protocol tcp \
  --port 5432 \
  --source-group sg-03c0ec5e219e2d06c \
  --group-owner-id 899469777864 \
  --region us-east-1
```

### 🟢 OPCIONAL - Crear Elastic IP
```bash
# Asignar una Elastic IP para evitar cambios futuros
aws ec2 allocate-address --domain vpc --region us-east-1
# Luego asociarla a la instancia i-0308ce1e41ebafc5b
```

---

## 🧪 7. PRUEBA DE CONEXIÓN A RDS

### Opción 1: Usando Docker con psql
```bash
docker run --rm -it postgres:17 psql \
  -h comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d postgres
```

### Opción 2: Instalar psql localmente
```bash
sudo yum install -y postgresql15
psql -h comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d postgres
```

---

## 🚀 8. PASOS PARA DESPLEGAR LA APLICACIÓN

### 1. Actualizar Route 53 (CRÍTICO)
Ejecutar los comandos de la sección 6.

### 2. Configurar variables de ambiente
```bash
cd /home/ec2-user/comunidade-ativa

# Verificar que existan los archivos .env
ls -la backend/.env backend/.env.production
ls -la frontend/.env

# Actualizar el endpoint de RDS en backend/.env.production
# DB_HOST=comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com
```

### 3. Ejecutar migraciones de Sequelize
```bash
cd backend
npm install
npx sequelize-cli db:migrate
```

### 4. Levantar la aplicación con Docker Compose
```bash
cd /home/ec2-user/comunidade-ativa
docker compose -f docker-compose.prod.yml up -d
```

### 5. Verificar que los contenedores estén corriendo
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 6. Probar la aplicación
```bash
# Health check del backend
curl http://localhost:3001/api/versao

# Health check del frontend
curl http://localhost:80
```

### 7. Acceder desde el dominio
Esperar propagación DNS (5-10 minutos) y acceder a:
- http://comuva.com
- http://www.comuva.com

---

## 📊 9. CHECKLIST FINAL

- [ ] Route 53 actualizado con nueva IP
- [ ] DNS propagado (verificar con `nslookup comuva.com`)
- [ ] Security Group de RDS ajustado (opcional pero recomendado)
- [ ] Variables de ambiente configuradas
- [ ] Migraciones de base de datos ejecutadas
- [ ] Contenedores Docker corriendo
- [ ] Health checks respondiendo
- [ ] Aplicación accesible desde el dominio

---

## 🔧 10. TROUBLESHOOTING

### Si la aplicación no conecta a RDS:
```bash
# Verificar conectividad
telnet comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com 5432

# Verificar logs del backend
docker compose -f docker-compose.prod.yml logs backend
```

### Si el dominio no resuelve:
```bash
# Verificar DNS
nslookup comuva.com
dig comuva.com

# Limpiar cache DNS local
sudo systemd-resolve --flush-caches
```

### Si Docker no puede hacer pull de imágenes:
```bash
# Verificar conectividad a Internet
curl -I https://registry-1.docker.io

# Verificar espacio en disco
df -h
```

---

## 📝 NOTAS FINALES

1. **Elastic IP:** Considera asignar una Elastic IP a tu EC2 para evitar cambios de IP en reinicios
2. **Backups:** Verifica que RDS tenga backups automáticos habilitados
3. **Monitoreo:** Configura CloudWatch Alarms para la EC2 y RDS
4. **Seguridad:** Considera restringir el acceso SSH a tu EC2 (actualmente no hay regla SSH en el SG)
5. **Costos:** Monitorea el uso de RDS y EC2 para optimizar costos

---

**Estado General:** ✅ Infraestructura lista para desplegar  
**Acción Crítica:** Actualizar Route 53 antes de desplegar
