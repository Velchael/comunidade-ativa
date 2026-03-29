#!/bin/bash

# Script para iniciar RDS y EC2
# Usa cuando necesites trabajar en el proyecto

set -e

REGION="us-east-1"
RDS_ID="comunidad-db-restaurada"
EC2_ID="i-0308ce1e41ebafc5b"

echo "🚀 Iniciando recursos AWS..."
echo ""

# Iniciar RDS
echo "📦 Iniciando RDS: $RDS_ID"
aws rds start-db-instance \
  --db-instance-identifier $RDS_ID \
  --region $REGION \
  --output json > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ RDS en proceso de inicio (toma ~5 minutos)"
else
  echo "⚠️  RDS ya está iniciado o en proceso"
fi

echo ""

# Iniciar EC2
echo "💻 Iniciando EC2: $EC2_ID"
aws ec2 start-instances \
  --instance-ids $EC2_ID \
  --region $REGION \
  --output json > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ EC2 en proceso de inicio (toma ~1 minuto)"
else
  echo "⚠️  EC2 ya está iniciado o en proceso"
fi

echo ""
echo "⏳ Esperando que los recursos estén disponibles..."
echo ""

# Esperar RDS
echo "   Esperando RDS..."
aws rds wait db-instance-available \
  --db-instance-identifier $RDS_ID \
  --region $REGION 2>/dev/null && echo "   ✅ RDS disponible"

# Esperar EC2
echo "   Esperando EC2..."
aws ec2 wait instance-running \
  --instance-ids $EC2_ID \
  --region $REGION 2>/dev/null && echo "   ✅ EC2 disponible"

echo ""
echo "📊 Estado actual de recursos:"
echo ""

# Verificar estado RDS
RDS_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier $RDS_ID \
  --region $REGION \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text)

RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier $RDS_ID \
  --region $REGION \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "   RDS: $RDS_STATUS"
echo "   Endpoint: $RDS_ENDPOINT"

# Verificar estado EC2
EC2_STATUS=$(aws ec2 describe-instances \
  --instance-ids $EC2_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text)

EC2_IP=$(aws ec2 describe-instances \
  --instance-ids $EC2_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "   EC2: $EC2_STATUS"
echo "   IP Pública: $EC2_IP"

echo ""
echo "✅ Recursos listos para trabajar!"
