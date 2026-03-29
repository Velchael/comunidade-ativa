#!/bin/bash

# Verifica parâmetros
if [ $# -ne 2 ]; then
    echo "Uso: $0 <cluster-name> <service-name>"
    exit 1
fi

CLUSTER_NAME=$1
SERVICE_NAME=$2

# Obtém commit hash (7 dígitos)
COMMIT_HASH=$(git rev-parse --short=7 HEAD)
echo "Commit hash: $COMMIT_HASH"

# Configurações ECR
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-east-1"
ECR_REPO="comunidad"
IMAGE_TAG="$COMMIT_HASH"
IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG"

echo "Building and pushing image: $IMAGE_URI"

# Build e push da imagem
docker build -t $ECR_REPO:$IMAGE_TAG .
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
docker tag $ECR_REPO:$IMAGE_TAG $IMAGE_URI
docker push $IMAGE_URI

# Obtém task definition atual
TASK_DEF_ARN=$(aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --query 'services[0].taskDefinition' --output text --region $AWS_REGION)
TASK_DEF_FAMILY=$(aws ecs describe-task-definition --task-definition $TASK_DEF_ARN --query 'taskDefinition.family' --output text --region $AWS_REGION)

# Cria nova task definition com nova imagem
aws ecs describe-task-definition --task-definition $TASK_DEF_ARN --query 'taskDefinition' --region $AWS_REGION > temp-task-def.json

# Atualiza imagem na task definition
jq --arg image "$IMAGE_URI" '.containerDefinitions[0].image = $image | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)' temp-task-def.json > new-task-def.json

# Registra nova task definition
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition --cli-input-json file://new-task-def.json --query 'taskDefinition.taskDefinitionArn' --output text --region $AWS_REGION)

# Atualiza service
aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --task-definition $NEW_TASK_DEF_ARN --region $AWS_REGION

# Limpa arquivos temporários
rm temp-task-def.json new-task-def.json

echo "Deploy concluído!"
echo "Nova task definition: $NEW_TASK_DEF_ARN"
echo "Imagem: $IMAGE_URI"
