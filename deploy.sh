#!/bin/bash

# Script de despliegue paso a paso
# Proyecto: comunidade-ativa

set -e

echo "🚀 DESPLIEGUE DE COMUNIDADE-ATIVA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Función para pausar y esperar confirmación
pause() {
    read -p "Presiona ENTER para continuar..."
    echo ""
}

# Paso 1: Validar infraestructura
echo "📋 PASO 1: Validando infraestructura..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./validar-infra.sh
pause

# Paso 2: Actualizar Route 53
echo "📋 PASO 2: Actualizar Route 53"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  IMPORTANTE: Esto actualizará los registros DNS"
echo "   comuva.com → 184.73.41.143"
echo "   www.comuva.com → 184.73.41.143"
echo ""
read -p "¿Deseas actualizar Route 53? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    ./update-route53.sh
    echo ""
    echo "⏳ Esperando 30 segundos para propagación DNS..."
    sleep 30
else
    echo "⏭️  Saltando actualización de Route 53"
fi
echo ""
pause

# Paso 3: Verificar variables de ambiente
echo "📋 PASO 3: Verificar variables de ambiente"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verificando archivos .env..."
echo ""

if [ -f "backend/.env.production" ]; then
    echo "✅ backend/.env.production existe"
    echo ""
    echo "Contenido actual (sin valores sensibles):"
    grep -E "^(DB_HOST|DB_NAME|DB_USER|NODE_ENV|PORT)" backend/.env.production || echo "   (archivo vacío o sin variables clave)"
else
    echo "❌ backend/.env.production NO EXISTE"
    echo ""
    echo "Creando archivo de ejemplo..."
    cat > backend/.env.production << 'EOF'
NODE_ENV=production
PORT=3001

# Database
DB_HOST=comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD_AQUI

# Session
SESSION_SECRET=TU_SESSION_SECRET_AQUI
EOF
    echo "⚠️  DEBES EDITAR backend/.env.production con las credenciales correctas"
    echo "   nano backend/.env.production"
fi
echo ""
pause

# Paso 4: Probar conexión a RDS
echo "📋 PASO 4: Probar conexión a RDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "¿Deseas probar la conexión a RDS con psql? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "Ejecutando psql en Docker..."
    echo "Comando: docker run --rm -it postgres:17 psql -h comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com -U postgres -d postgres"
    echo ""
    docker run --rm -it postgres:17 psql \
        -h comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com \
        -U postgres \
        -d postgres
else
    echo "⏭️  Saltando prueba de conexión"
fi
echo ""
pause

# Paso 5: Ejecutar migraciones
echo "📋 PASO 5: Ejecutar migraciones de Sequelize"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "¿Deseas ejecutar las migraciones? (s/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Ss]$ ]]; then
    cd backend
    echo "Instalando dependencias..."
    npm install --loglevel=error
    echo ""
    echo "Ejecutando migraciones..."
    npx sequelize-cli db:migrate
    cd ..
else
    echo "⏭️  Saltando migraciones"
fi
echo ""
pause

# Paso 6: Levantar contenedores
echo "📋 PASO 6: Levantar contenedores Docker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Deteniendo contenedores existentes (si los hay)..."
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
echo ""
echo "Construyendo y levantando contenedores..."
docker compose -f docker-compose.prod.yml up -d --build
echo ""
echo "Esperando 10 segundos para que los contenedores inicien..."
sleep 10
echo ""
echo "Estado de los contenedores:"
docker compose -f docker-compose.prod.yml ps
echo ""
pause

# Paso 7: Verificar health checks
echo "📋 PASO 7: Verificar health checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Probando backend (http://localhost:3001/api/versao)..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/versao || echo "000")
if [ "$BACKEND_STATUS" == "200" ]; then
    echo "✅ Backend respondiendo correctamente"
    curl -s http://localhost:3001/api/versao | jq . || curl -s http://localhost:3001/api/versao
else
    echo "❌ Backend no responde (HTTP $BACKEND_STATUS)"
    echo "Logs del backend:"
    docker compose -f docker-compose.prod.yml logs backend | tail -n 20
fi
echo ""

echo "Probando frontend (http://localhost:80)..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80 || echo "000")
if [ "$FRONTEND_STATUS" == "200" ]; then
    echo "✅ Frontend respondiendo correctamente"
else
    echo "❌ Frontend no responde (HTTP $FRONTEND_STATUS)"
    echo "Logs del frontend:"
    docker compose -f docker-compose.prod.yml logs frontend | tail -n 20
fi
echo ""
pause

# Paso 8: Verificar acceso desde dominio
echo "📋 PASO 8: Verificar acceso desde dominio"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Verificando DNS..."
CURRENT_IP=$(dig +short comuva.com | head -n1)
echo "comuva.com resuelve a: $CURRENT_IP"
echo ""

if [ "$CURRENT_IP" == "184.73.41.143" ]; then
    echo "✅ DNS correcto"
    echo ""
    echo "Probando acceso desde el dominio..."
    DOMAIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://comuva.com --max-time 10 || echo "000")
    if [ "$DOMAIN_STATUS" == "200" ]; then
        echo "✅ Aplicación accesible desde http://comuva.com"
    else
        echo "⚠️  Dominio no responde aún (HTTP $DOMAIN_STATUS)"
        echo "   Puede tardar unos minutos en propagar"
    fi
else
    echo "⚠️  DNS aún no propagado o incorrecto"
    echo "   Espera 5-10 minutos y verifica con: nslookup comuva.com"
fi
echo ""

# Resumen final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DESPLIEGUE COMPLETADO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Resumen:"
echo "   • Backend: http://localhost:3001/api/versao"
echo "   • Frontend: http://localhost:80"
echo "   • Dominio: http://comuva.com"
echo ""
echo "📝 Comandos útiles:"
echo "   • Ver logs: docker compose -f docker-compose.prod.yml logs -f"
echo "   • Reiniciar: docker compose -f docker-compose.prod.yml restart"
echo "   • Detener: docker compose -f docker-compose.prod.yml down"
echo "   • Validar: ./validar-infra.sh"
echo ""
