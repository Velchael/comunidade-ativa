# Projeto comunidad - Contexto e Análise

## Visão Geral do Projeto
**Nome:** comunidad 
**Versão:** 4.2.0  
**Período do Bootcamp:** 27/09 a 28/09/2025 (Online e ao Vivo das 9h30 às 17h30)  
**Repositório:** https://github.com/henrylle/bia

## Impressões Iniciais do Desenvolvedor
O projeto da comunidad é um projeto educacional criado pelo Stalin Mendez (@henryllemaia) para ser usado nos eventos que ele realiza e servir de base para o treinamento Formação AWS.

É um projeto concebido no ano de 2021 e que vem evoluindo usando as melhores práticas dentro da AWS.

O foco base dele é fornecer uma estrutura educacional em que o aluno possa evoluir gradualmente, desde problemas simples até situações mais complexas.


---

## Análise Técnica (Amazon Q)

### Arquitetura Identificada
- **Frontend:** React 17.0.2 
- **Backend:** Node.js com Express 4.17.1
- **Banco de Dados:** PostgreSQL 16.1
- **ORM:** Sequelize 6.6.5
- **Containerização:** Docker com Docker Compose

### Stack Tecnológica
**Frontend:**
- React com React Router DOM
- React Icons para ícones
### - Vite como bundler (configurado no Dockerfile)

**Backend:**
- Express.js como framework web
- Sequelize como ORM
- Morgan para logging
- CORS habilitado
- Express Session para gerenciamento de sessões
- EJS e HBS como template engines

**Infraestrutura:**
- Docker containerizado (usa docker-compose.prod.yml em EC2)
- AWS SDK integrado (Secrets Manager, STS)
- PostgreSQL como banco principal
- Suporte a variáveis de ambiente

### Estrutura do Projeto
```


/comunidad-activa/
├── backend/
│    ├── config/
│    ├── migrations/      
│    ├── models/
│    ├── src/
│         ├── config/
│         ├── controllers/
│         ├── db/
│         ├──  middleware/      
│         ├──  models/ 
│         ├── routes/
│         ├── utils/
│   compose.yml         # Docker Compose 
|   Dockerfile.dev          # Container da aplicação
|   Dockerfile.prod          # Container da aplicação
│   .env
|   .env.production
|   app.js
|   server.js
|
├── frontend/ 
|    ├── build/
│    ├── nginx/      
│    ├── public/
│    ├── src/
│         ├── components/
│         ├── hooks/
│         ├──  Screens/      
|           App.js  
|           index.js
|           UserContext.js
|           utils.js
|   .env
|   Dockerfile.dev          # Container da aplicação
|   Dockerfile.prod          # Container da aplicação
├── scripts/
|     ├── ecs/
├── docker-compose.yml         # Usado localmente (dev)
├── docker-compose.prod.yml    # Usado en EC2 (producción)
├── deploy-ecs.sh


```

### Recursos AWS Identificados
- **ECR:** Registry para imagens Docker (configurado no buildspec.yml)
- **CodeBuild:** Pipeline de CI/CD já configurado
- **Secrets Manager:** Gerenciamento de credenciais
- **STS:** Tokens temporários de acesso

### Pontos de Atenção
1. **Segurança:** Credenciais hardcoded no compose.yml (apenas para desenvolvimento)
2. **Escalabilidade:** Aplicação monolítica, mas bem estruturada
3. **Monitoramento:** Healthcheck comentado no Docker Compose
4. **Testes:** Estrutura de testes presente com Jest

### Rotas da API para Testes
### - **`/api/versao`:** Retorna versão da aplicação (não usa banco)
### - **`/api/tarefas`:** Retorna dados do banco PostgreSQL (ideal para testar conectividade com RDS)