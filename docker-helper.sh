#!/bin/bash

clear
echo "📦 Docker Helper - Comunidad Activa"
echo "----------------------------------"

# Verifica si Docker está corriendo
if ! docker info > /dev/null 2>&1; then
  echo "🚫 Docker no está corriendo. Por favor, inicia Docker Desktop o el servicio."
  exit 1
fi

# Función auxiliar: obtener ID del contenedor
get_container_id() {
  docker compose ps -q "$1"
}

echo "1) 🧱 Reconstruir y levantar todos los contenedores (build completo)"
echo "2) 📄 Ver logs del backend (en tiempo real)"
echo "3) 📄 Ver últimas 50 líneas de logs del backend"
echo "4) 🔍 Buscar palabra clave en logs del backend"
echo "5) 📦 Ejecutar migraciones dentro del contenedor"
echo "6) 🔧 Entrar al contenedor backend"
echo "7) 🛢️ Entrar al contenedor de base de datos (psql)"
echo "8) ♻️ Reconstruir y levantar solo el backend"
echo "9) ♻️ Reconstruir y reiniciar solo el frontend (producción)"
echo "10) 📄 Logs frontend (últimas 50 líneas + seguimiento en vivo)"
echo "11) 🚀 Levantar frontend-dev (modo desarrollo con hot reload en 3001)"
echo "0) ❌ Salir"

read -p "Selecciona una opción: " option

case $option in
  1)
    echo "🧹 Deteniendo contenedores..."
    docker compose down --remove-orphans
    sleep 2
    echo "🔧 Reconstruyendo imágenes y levantando contenedores..."
    docker compose up --build
    # echo "🌐 Frontend producción: http://localhost:3002"
    echo "🌐 Frontend desarrollo: http://localhost:3001"
    echo "🖥️  Backend: http://localhost:3000"
    ;;
  2)
    echo "📄 Logs del backend (seguimiento en vivo)..."
    docker logs -f $(get_container_id backend)
    ;;
  3)
    echo "📄 Últimas 50 líneas de logs del backend..."
    docker logs --tail 50 $(get_container_id backend)
    ;;
  4)
    read -p "🔍 Palabra a buscar en logs del backend: " keyword
    docker logs $(get_container_id backend) 2>&1 | grep --color=always "$keyword"
    ;;
  5)
    echo "🚀 Ejecutando migraciones dentro del contenedor backend..."
    docker exec -it $(get_container_id backend) node migrate.js
    ;;
  6)
    echo "🔧 Entrando al contenedor backend..."
    docker exec -it $(get_container_id backend) bash
    ;;
  7)
    echo "🛢️ Entrando a la base de datos (psql)..."
    docker exec -it $(get_container_id db) psql -U postgres -d comunidad
    ;;
  8)
    echo "♻️ Reconstruyendo y levantando solo el backend..."
    docker compose up --build -d backend
    ;;
  9)
    echo "♻️ Reconstruyendo y reiniciando solo el frontend (producción)..."
    docker compose build frontend
    docker compose up -d frontend
    ;;
  10)
    echo "📄 Logs frontend (últimas 50 líneas + seguimiento en vivo)..."
    docker logs --tail 50 -f $(get_container_id frontend)
    ;;
  11)
    echo "🚀 Levantando frontend-dev (modo desarrollo con hot reload en 3001)..."
    docker compose up frontend-dev
    echo "🌐 Disponible en: http://localhost:3001"
    #docker restart comunidad-activa-frontend-dev-1
    ;;
  0)
    echo "👋 Saliendo..."
    exit 0
    ;;
  *)
    echo "❌ Opción inválida"
    ;;
esac



