# Regras de Infraestrutura - Projeto Comunidad

## Arquitetura Base
- **Plataforma:** ECS com cluster de instâncias EC2
- **Evolução:** Iniciar sem ALB → Evoluir para incluir ALB

## Tipos de Instância
- **RDS (Database):** t3.micro
- **EC2 (ECS Cluster):** t3.micro

## Filosofia de Simplicidade
- **Público-alvo:** Alunos em aprendizado
- **Abordagem:** Simplicidade acima de complexidade
- **Objetivo:** Facilitar compreensão de quem está na etapa inicial da jornada

## Recursos Avançados - NÃO INCLUIR
- **Secrets Manager:** É um estágio mais avançado do aprendizado
- **Multi-AZ deployments:** Manter configuração simples
- **Auto Scaling complexo:** Usar configurações básicas

## Padrão de Nomenclatura

### Prefixo Padrão
- **Prefixo:** `comunidad` (nome do projeto)

### Nomenclatura de Recursos ECS
- **Cluster com ALB:** `cluster-comunidad-alb`
- **Cluster sem ALB:** `cluster-comunidad`
- **Task Definition com ALB:** `task-def-comunidad-alb` (prefixo task-def e sufixo -alb)
- **Task Definition sem ALB:** `task-def-comunidad` (prefixo task-def)
- **Service:** `service-comunidad` (sem alb)
- **Service:** `service-comunidad-alb` (com alb)

### Sufixos dos Security Groups

#### Cenário 1: Sem ALB (Inicial)
- **Database (RDS):** `comunidad-db`
- **EC2 (ECS Cluster):** `comunidad-web`

#### Cenário 2: Com ALB (Evolução)
- **Database (RDS):** `comunidad-db`
- **Application Load Balancer:** `comunidad-alb`
- **EC2 (ECS Cluster):** `comunidad-ec2`

## Regras de Security Groups

### Padrão de Descrição das Inbound Rules
- **Formato obrigatório:** "acesso vindo de (nome do security group)"
- **Exemplo:** "acesso vindo de comunidad-dev"
- **Aplicação:** APENAS para inbound rules

### Database (comunidad-db)
**Inbound Rules:**
- **Porta:** 5432 (PostgreSQL)
- **Sources:** 
  - `comunidad-dev` → Descrição: "acesso vindo de comunidad-dev"
  - `comunidad-ec2` (quando com ALB) → Descrição: "acesso vindo de comunidad-ec2"
  - `comunidad-web` (quando sem ALB) → Descrição: "acesso vindo de comunidad-web"

### EC2 com ALB (comunidad-ec2)
**Inbound Rules:**
- **Protocolo:** All TCP
- **Source:** `comunidad-alb` → Descrição: "acesso vindo de comunidad-alb"
- **Motivo:** Portas aleatórias do ECS Service

### Application Load Balancer (comunidad-alb)
**Inbound Rules:**
- **Porta:** 80/443
- **Source:** 0.0.0.0/0 → Descrição: "acesso público HTTP/HTTPS"

## Banco de Dados
- **Aproveitamento:** Usar banco existente na infraestrutura
- **Não criar:** Novos recursos RDS nos templates
- **Security Group:** Manter `comunidad-db` preparado para conexão

### Observações
- As regras seguem o princípio de menor privilégio
- Security Groups referenciam outros Security Groups para maior flexibilidade
- Configuração permite evolução da arquitetura sem grandes mudanças