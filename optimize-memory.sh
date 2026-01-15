#!/bin/bash

echo "🔧 Optimizando memoria del sistema..."

# Limpiar cache del sistema
sudo sync
sudo sysctl vm.drop_caches=3

# Optimizar swappiness
sudo sysctl vm.swappiness=10

# Limpiar Docker
docker system prune -f

# Mostrar estado actual
echo "📊 Estado actual de memoria:"
free -h

echo "🐳 Uso de memoria por contenedores:"
docker stats --no-stream --format "table {{.Names}}\t{{.MemUsage}}\t{{.MemPerc}}"

echo "✅ Optimización completada"
