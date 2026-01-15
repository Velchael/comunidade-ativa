# Diagnóstico CSP - Comandos de Troubleshooting

## Comandos para Diagnóstico de Headers CSP

### Verificar headers del frontend
```bash
curl -I https://comunidad-ativa.reddevida.com.br
```

### Verificar headers del backend directamente
```bash
curl -I http://localhost:3000/api/versao
```

### Verificar configuración de Nginx
```bash
docker exec comunidade-ativa-frontend-1 cat /etc/nginx/conf.d/default.conf
```

## Troubleshooting Común

- **CSP restrictivo:** Verificar que Nginx esté usando `proxy_hide_header Content-Security-Policy`
- **Cache del navegador:** Limpiar con Ctrl+Shift+R o modo incógnito
- **Backend enviando CSP:** El middleware en `app.js` debe interceptar y eliminar headers CSP
