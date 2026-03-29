#!/bin/bash

# Script para parar RDS y EC2
# Ahorra ~$20/mes cuando no estás trabajando

set -e

REGION="us-east-1"
RDS_ID="comunidad-db-restaurada"
EC2_ID="i-0308ce1e41ebafc5b"

echo "🛑 Parando recursos AWS..."
echo ""

# Parar RDS
echo "📦 Parando RDS: $RDS_ID"
aws rds stop-db-instance \
  --db-instance-identifier $RDS_ID \
  --region $REGION \
  --output json > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ RDS en proceso de parada (toma ~5 minutos)"
else
  echo "⚠️  RDS ya está parado o en proceso"
fi

echo ""

# Parar EC2
echo "💻 Parando EC2: $EC2_ID"
aws ec2 stop-instances \
  --instance-ids $EC2_ID \
  --region $REGION \
  --output json > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ EC2 en proceso de parada (toma ~1 minuto)"
else
  echo "⚠️  EC2 ya está parado o en proceso"
fi

echo ""
echo "📊 Estado actual de recursos:"
echo ""

# Verificar estado RDS
RDS_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier $RDS_ID \
  --region $REGION \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text 2>/dev/null || echo "error")

echo "   RDS: $RDS_STATUS"

# Verificar estado EC2
EC2_STATUS=$(aws ec2 describe-instances \
  --instance-ids $EC2_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text 2>/dev/null || echo "error")

echo "   EC2: $EC2_STATUS"

echo ""
echo "💰 Ahorro estimado mientras están parados: ~$0.66/día"
echo ""
echo "ℹ️  Para iniciar recursos usa: ./start-recursos.sh"
