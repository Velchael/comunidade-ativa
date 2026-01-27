-- Permitir que colider_nombre seja NULL
ALTER TABLE grupos_activos ALTER COLUMN colider_nombre DROP NOT NULL;
