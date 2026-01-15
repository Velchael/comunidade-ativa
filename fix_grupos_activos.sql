-- Script para restaurar estrutura original da tabela grupos_activos
-- Converte colider_id e anfitrion_id (INTEGER) para colider_nombre e anfitrion_nombre (VARCHAR)

BEGIN;

-- 1. Remover constraints de foreign key
ALTER TABLE grupos_activos DROP CONSTRAINT IF EXISTS grupos_activos_colider_id_fkey;
ALTER TABLE grupos_activos DROP CONSTRAINT IF EXISTS grupos_activos_anfitrion_id_fkey;

-- 2. Adicionar novas colunas VARCHAR
ALTER TABLE grupos_activos ADD COLUMN colider_nombre VARCHAR(255);
ALTER TABLE grupos_activos ADD COLUMN anfitrion_nombre VARCHAR(255);

-- 3. Migrar dados existentes (se houver)
-- Buscar nomes dos usuários baseado nos IDs e popular as novas colunas
UPDATE grupos_activos 
SET colider_nombre = COALESCE(u.nome, 'Nome não encontrado')
FROM users u 
WHERE grupos_activos.colider_id = u.id AND grupos_activos.colider_id IS NOT NULL;

UPDATE grupos_activos 
SET anfitrion_nombre = COALESCE(u.nome, 'Nome não encontrado')
FROM users u 
WHERE grupos_activos.anfitrion_id = u.id AND grupos_activos.anfitrion_id IS NOT NULL;

-- 4. Definir valores padrão para registros sem dados
UPDATE grupos_activos 
SET colider_nombre = 'A definir' 
WHERE colider_nombre IS NULL;

UPDATE grupos_activos 
SET anfitrion_nombre = 'A definir' 
WHERE anfitrion_nombre IS NULL;

-- 5. Tornar as novas colunas NOT NULL
ALTER TABLE grupos_activos ALTER COLUMN colider_nombre SET NOT NULL;
ALTER TABLE grupos_activos ALTER COLUMN anfitrion_nombre SET NOT NULL;

-- 6. Remover colunas antigas
ALTER TABLE grupos_activos DROP COLUMN colider_id;
ALTER TABLE grupos_activos DROP COLUMN anfitrion_id;

COMMIT;
