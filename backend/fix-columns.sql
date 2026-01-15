-- Cambiar colider_id de INTEGER a VARCHAR
ALTER TABLE grupos_activos 
ALTER COLUMN colider_id TYPE VARCHAR USING colider_id::VARCHAR;

-- Cambiar anfitrion_id de INTEGER a VARCHAR  
ALTER TABLE grupos_activos 
ALTER COLUMN anfitrion_id TYPE VARCHAR USING anfitrion_id::VARCHAR;

-- Verificar cambios
\d grupos_activos;
