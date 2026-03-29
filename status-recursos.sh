#!/bin/bash

# Script para verificar estado de recursos AWS

REGION="us-east-1"
RDS_ID="comunidad-db-restaurada"
EC2_ID="i-0308ce1e41ebafc5b"

echo "📊 Estado de Recursos AWS"
echo "=========================="
echo ""

# RDS Status
echo "📦 RDS Database:"
RDS_STATUS=$(aws rds describe-db-instances \
  --db-instance-identifier $RDS_ID \
  --region $REGION \
  --query 'DBInstances[0].DBInstanceStatus' \
  --output text 2>/dev/null || echo "error")

echo "   ID: $RDS_ID"
echo "   Estado: $RDS_STATUS"

if [ "$RDS_STATUS" = "available" ]; then
  RDS_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier $RDS_ID \
    --region $REGION \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)
  echo "   Endpoint: $RDS_ENDPOINT"
fi

echo ""

# EC2 Status
echo "💻 EC2 Instance:"
EC2_STATUS=$(aws ec2 describe-instances \
  --instance-ids $EC2_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text 2>/dev/null || echo "error")

echo "   ID: $EC2_ID"
echo "   Estado: $EC2_STATUS"

if [ "$EC2_STATUS" = "running" ]; then
  EC2_IP=$(aws ec2 describe-instances \
    --instance-ids $EC2_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)
  echo "   IP Pública: $EC2_IP"
fi

echo ""

# Calcular costo por hora
COST_HOUR=0
if [ "$RDS_STATUS" = "available" ]; then
  COST_HOUR=$(echo "$COST_HOUR + 0.017" | bc)
fi
if [ "$EC2_STATUS" = "running" ]; then
  COST_HOUR=$(echo "$COST_HOUR + 0.0104" | bc)
fi

echo "💰 Costo Actual:"
echo "   Por hora: \$$COST_HOUR"
echo "   Por día: \$$(echo "$COST_HOUR * 24" | bc)"
echo "   Por mes: \$$(echo "$COST_HOUR * 730" | bc)"
echo ""

# Recomendaciones
if [ "$RDS_STATUS" = "available" ] || [ "$EC2_STATUS" = "running" ]; then
  echo "💡 Tip: Para ahorrar costos cuando no trabajes:"
  echo "   ./stop-recursos.sh"
fi
