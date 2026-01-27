#!/bin/bash
set -e

# =========================
# CONFIGURACIÓN
# =========================
AWS_REGION="us-east-1"
AWS_ACCOUNT_ID="899469777864"
ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

BACKEND_IMAGE="comunidade-ativa-backend"
FRONTEND_IMAGE="comunidade-ativa-frontend"
TAG="latest"

# =========================
# LOGIN ECR
# =========================
echo "🔐 Login en Amazon ECR..."
aws ecr get-login-password --region $AWS_REGION | \
docker login --username AWS --password-stdin $ECR_REGISTRY

# =========================
# BUILD CON DOCKER COMPOSE
# =========================
echo "🏗️ Construyendo imágenes (backend y frontend)..."
docker compose -f docker-compose.prod.yml build

# =========================
# TAG IMÁGENES
# =========================
echo "🏷️ Etiquetando imágenes..."
docker tag ${BACKEND_IMAGE}:latest $ECR_REGISTRY/${BACKEND_IMAGE}:$TAG
docker tag ${FRONTEND_IMAGE}:latest $ECR_REGISTRY/${FRONTEND_IMAGE}:$TAG

# =========================
# PUSH A ECR
# =========================
echo "📤 Subiendo imágenes a ECR..."
docker push $ECR_REGISTRY/${BACKEND_IMAGE}:$TAG
docker push $ECR_REGISTRY/${FRONTEND_IMAGE}:$TAG

echo "✅ Build y push completados con éxito"

