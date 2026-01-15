-- Script corrigido para restaurar estrutura original da tabela grupos_activos
BEGIN;

-- 1. Remover constraints de foreign key
ALTER TABLE grupos_activos DROP CONSTRAINT IF EXISTS grupos_activos_colider_id_fkey;
ALTER TABLE grupos_activos DROP CONSTRAINT IF EXISTS grupos_activos_anfitrion_id_fkey;

-- 2. Adicionar novas colunas VARCHAR
ALTER TABLE grupos_activos ADD COLUMN colider_nombre VARCHAR(255);
ALTER TABLE grupos_activos ADD COLUMN anfitrion_nombre VARCHAR(255);

-- 3. Definir valores padrão para todos os registros
UPDATE grupos_activos SET colider_nombre = 'A definir';
UPDATE grupos_activos SET anfitrion_nombre = 'A definir';

-- 4. Tornar as novas colunas NOT NULL
ALTER TABLE grupos_activos ALTER COLUMN colider_nombre SET NOT NULL;
ALTER TABLE grupos_activos ALTER COLUMN anfitrion_nombre SET NOT NULL;

-- 5. Remover colunas antigas
ALTER TABLE grupos_activos DROP COLUMN colider_id;
ALTER TABLE grupos_activos DROP COLUMN anfitrion_id;

COMMIT;
