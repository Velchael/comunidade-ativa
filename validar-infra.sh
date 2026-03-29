#!/bin/bash

# Script de validación rápida de infraestructura
# Proyecto: comunidade-ativa

echo "🔍 VALIDACIÓN RÁPIDA DE INFRAESTRUCTURA"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Conectividad a RDS
echo "1️⃣  Probando conectividad a RDS..."
if timeout 5 bash -c 'cat < /dev/null > /dev/tcp/comunidad-db-restaurada.cw74go0io7nb.us-east-1.rds.amazonaws.com/5432' 2>/dev/null; then
    echo "   ✅ RDS accesible (puerto 5432)"
else
    echo "   ❌ RDS no accesible"
fi
echo ""

# 2. Conectividad a Internet
echo "2️⃣  Probando conectividad a Internet..."
if curl -s -o /dev/null -w "%{http_code}" https://www.google.com --max-time 5 | grep -q "200"; then
    echo "   ✅ Internet accesible"
else
    echo "   ❌ Sin acceso a Internet"
fi
echo ""

# 3. Docker
echo "3️⃣  Verificando Docker..."
if docker --version &>/dev/null; then
    echo "   ✅ Docker instalado: $(docker --version | cut -d' ' -f3)"
else
    echo "   ❌ Docker no instalado"
fi
echo ""

# 4. Docker Compose
echo "4️⃣  Verificando Docker Compose..."
if docker compose version &>/dev/null; then
    echo "   ✅ Docker Compose instalado: $(docker compose version | cut -d' ' -f4)"
else
    echo "   ❌ Docker Compose no instalado"
fi
echo ""

# 5. Archivos de configuración
echo "5️⃣  Verificando archivos de configuración..."
if [ -f "docker-compose.prod.yml" ]; then
    echo "   ✅ docker-compose.prod.yml existe"
else
    echo "   ❌ docker-compose.prod.yml no encontrado"
fi

if [ -f "backend/.env.production" ]; then
    echo "   ✅ backend/.env.production existe"
else
    echo "   ⚠️  backend/.env.production no encontrado"
fi

if [ -f "frontend/.env" ]; then
    echo "   ✅ frontend/.env existe"
else
    echo "   ⚠️  frontend/.env no encontrado"
fi
echo ""

# 6. DNS
echo "6️⃣  Verificando DNS..."
CURRENT_IP=$(dig +short comuva.com | head -n1)
EXPECTED_IP="184.73.41.143"

if [ "$CURRENT_IP" == "$EXPECTED_IP" ]; then
    echo "   ✅ DNS apunta a la IP correcta: $CURRENT_IP"
else
    echo "   ⚠️  DNS apunta a: $CURRENT_IP (esperado: $EXPECTED_IP)"
fi
echo ""

# 7. Contenedores Docker
echo "7️⃣  Verificando contenedores Docker..."
if docker compose -f docker-compose.prod.yml ps 2>/dev/null | grep -q "Up"; then
    echo "   ✅ Contenedores corriendo:"
    docker compose -f docker-compose.prod.yml ps --format "table {{.Service}}\t{{.Status}}" 2>/dev/null | tail -n +2 | sed 's/^/      /'
else
    echo "   ⚠️  No hay contenedores corriendo"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Validación completada"
echo ""
echo "📄 Para ver el diagnóstico completo:"
echo "   cat diagnostico-infraestructura.md"
