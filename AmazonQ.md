# COMUVA - Contexto Estratégico e Arquitetura da Plataforma

## Visão Geral do Projeto

**Nome:** COMUVA — Comunidade Viva  
**Versão:** 1.0.1

---

# O QUE É O COMUVA

COMUVA é uma plataforma social comunitária baseada em interdependência humana, ajuda mútua e fortalecimento de comunidades reais.

Diferente das redes sociais tradicionais focadas apenas em entretenimento, conteúdo e engajamento superficial, o COMUVA foi criado para conectar pessoas que precisam de ajuda com pessoas que podem ajudar dentro de comunidades organizadas.

A plataforma busca recuperar princípios antigos das civilizações comunitárias, onde viver em comunidade não era uma opção, mas uma necessidade de sobrevivência.

No COMUVA:

- ajudar fortalece a comunidade
- participar gera impacto social real
- necessidades podem ser respondidas rapidamente
- comunidades se tornam mais organizadas
- líderes comunitários podem administrar seus próprios espaços

---

# FILOSOFIA CENTRAL

## “Nenhuma comunidade sobrevive sozinha.”

COMUVA foi idealizado como uma plataforma de:

- cooperação social
- organização comunitária
- suporte mútuo
- ajuda prática
- interação humana útil
- fortalecimento do tecido social

A plataforma permite:

✅ publicar necessidades  
✅ oferecer ajuda  
✅ organizar grupos  
✅ criar agendas comunitárias  
✅ gerar relatórios  
✅ administrar comunidades  
✅ fortalecer relações humanas reais  

---

# MODELO SOCIAL DA PLATAFORMA

O sistema foi desenhado para funcionar como uma arquitetura comunitária descentralizada.

Cada comunidade possui:

- liderança própria
- administração própria
- organização própria
- grupos ativos
- interações locais
- autonomia parcial

O COMUVA evolui para um modelo semelhante a:

- Reddit Communities
- Discord Servers
- Facebook Groups
- Slack Workspaces

Porém focado em:

✅ ajuda social  
✅ colaboração humana  
✅ comunidade ativa  
✅ organização local  

---

# SISTEMA DE ROLES (PERMISSÕES)

## admin_total

Administrador global da plataforma.

Permissões:

- gerenciamento total do sistema
- criação e moderação global de comunidades
- auditoria
- segurança
- controle administrativo geral
- estatísticas globais
- gerenciamento de usuários
- moderação total

---

## admin_basic (Líder Comunitário)

Administrador de sua própria comunidade.

Permissões:

✅ administrar sua comunidade  
✅ moderar interações  
✅ criar agendas  
✅ criar grupos  
✅ gerenciar relatórios  
✅ aprovar membros  
✅ organizar atividades locais  

Restrições:

❌ não controla o sistema inteiro  
❌ não administra outras comunidades  

---

## membro

Usuário padrão da plataforma.

Permissões:

✅ publicar necessidades  
✅ oferecer ajuda  
✅ responder interações  
✅ participar da comunidade  
✅ criar pequenos grupos  
✅ colaborar socialmente  

---

# FLUXO SOCIAL PRINCIPAL

## Novo Usuário

1. Login com Google
2. Completar perfil básico
3. Escolher:
   - entrar em uma comunidade
   - criar nova comunidade
4. Participar da comunidade
5. Publicar ou ajudar

---

# ARQUITETURA SOCIAL

## Ownership Real

Cada comunidade possui um proprietário/líder real:

```sql
owner_user_id

Isso permite:

autonomia comunitária
moderação distribuída
liderança real
escalabilidade
segurança organizacional
FUNCIONALIDADES PRINCIPAIS
Interações Comunitárias

Sistema de interação social baseado em:

necessidades
ajuda
produtos
serviços
respostas comunitárias

Inclui:

✅ filtros
✅ urgência
✅ visibilidade global/comunidade
✅ respostas sociais
✅ atualização automática
✅ UX otimizada

Grupos Ativos

Permite:

criação de grupos
liderança comunitária
organização de reuniões
relatórios
acompanhamento social
Agenda Comunitária

Sistema de tarefas e eventos comunitários.

Objetivo:

organizar atividades
melhorar comunicação
fortalecer coordenação social
OBJETIVO DE LONGO PRAZO

COMUVA pretende evoluir para uma plataforma de:

organização social descentralizada
suporte comunitário real
comunidades autogerenciáveis
cooperação prática
impacto social local

A arquitetura está sendo construída pensando em:

✅ produção real
✅ usuários reais
✅ escalabilidade
✅ segurança
✅ multi comunidades
✅ liderança distribuída
✅ crescimento sustentável

Análise Técnica (Amazon Q)
Arquitetura Identificada
Frontend: React 17.0.2
Backend: Node.js com Express 4.17.1
Banco de Dados: PostgreSQL 16.1
ORM: Sequelize 6.6.5
Containerização: Docker + Docker Compose
Stack Tecnológica
Frontend
React
React Router DOM
React Bootstrap
Axios
JWT Decode
React Helmet Async
Backend
Express.js
Sequelize ORM
JWT Authentication
Google OAuth
Morgan
CORS
Infraestrutura
Docker
Docker Compose
AWS EC2
AWS ECR
AWS CodeBuild
PostgreSQL
Nginx
Estrutura do Projeto
/comunidad-activa/
├── backend/
│    ├── config/
│    ├── migrations/
│    ├── models/
│    ├── src/
│         ├── config/
│         ├── controllers/
│         ├── db/
│         ├── middleware/
│         ├── models/
│         ├── routes/
│         ├── utils/
│
├── frontend/
│    ├── build/
│    ├── nginx/
│    ├── public/
│    ├── src/
│         ├── components/
│         ├── hooks/
│         ├── Screens/
│
├── scripts/
├── docker-compose.yml
├── docker-compose.prod.yml
├── deploy-ecs.sh
Recursos AWS Identificados
AWS ECR
AWS EC2
AWS CodeBuild
AWS Secrets Manager
AWS STS
Objetivo Atual do Desenvolvimento

A plataforma está sendo preparada para:

✅ deploy em produção
✅ testes com usuários reais
✅ escalabilidade social
✅ melhorias de UX/UI
✅ arquitetura multi comunidade
✅ moderação descentralizada
✅ fortalecimento da experiência comunitária

Rotas Principais da API
Autenticação
/api/auth/google
/api/auth/refresh
Usuários
/api/users
/api/users/google/complete
Comunidades
/api/comunidades
Interações
/api/interacciones
Respostas
/api/respostas
Agenda
/api/tasks
Grupos
/api/grupos
Relatórios
/api/reportes
Visão Estratégica

COMUVA não é apenas uma rede social.

É uma infraestrutura digital para fortalecimento de comunidades humanas reais.