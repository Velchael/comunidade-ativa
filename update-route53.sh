#!/bin/bash

# Script para actualizar Route 53 con la nueva IP de EC2
# Proyecto: comunidade-ativa

set -e

HOSTED_ZONE_ID="Z1035574TYP37YNTI879"
NEW_IP="184.73.41.143"
TTL=300

echo "🌐 Actualizando registros DNS en Route 53..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Hosted Zone: $HOSTED_ZONE_ID"
echo "Nueva IP: $NEW_IP"
echo ""

# Actualizar comuva.com
echo "📝 Actualizando comuva.com..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"comuva.com\",
        \"Type\": \"A\",
        \"TTL\": $TTL,
        \"ResourceRecords\": [{\"Value\": \"$NEW_IP\"}]
      }
    }]
  }" \
  --region us-east-1 \
  --output json | jq -r '.ChangeInfo.Id'

echo "✅ comuva.com actualizado"
echo ""

# Actualizar www.comuva.com
echo "📝 Actualizando www.comuva.com..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"www.comuva.com\",
        \"Type\": \"A\",
        \"TTL\": $TTL,
        \"ResourceRecords\": [{\"Value\": \"$NEW_IP\"}]
      }
    }]
  }" \
  --region us-east-1 \
  --output json | jq -r '.ChangeInfo.Id'

echo "✅ www.comuva.com actualizado"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Registros DNS actualizados correctamente"
echo ""
echo "⏳ La propagación DNS puede tardar 5-10 minutos"
echo ""
echo "Verificar con:"
echo "  nslookup comuva.com"
echo "  dig comuva.com"
