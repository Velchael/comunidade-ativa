#!/bin/bash

echo "🔍 Testando Content-Security-Policy..."
echo "========================================="

# Teste 1: Verificar headers CSP
echo "1. Verificando headers CSP:"
curl -I https://comunidad-ativa.reddevida.com.br 2>/dev/null | grep -i "content-security-policy"

echo ""
echo "2. Teste completo de headers de segurança:"
curl -I https://comunidad-ativa.reddevida.com.br 2>/dev/null | grep -E "(content-security-policy|x-frame-options|x-content-type-options|referrer-policy)"

echo ""
echo "3. Teste da API (health check):"
curl -s https://comunidad-ativa.reddevida.com.br/api/versao | head -1

echo ""
echo "========================================="
echo "✅ Teste concluído!"
