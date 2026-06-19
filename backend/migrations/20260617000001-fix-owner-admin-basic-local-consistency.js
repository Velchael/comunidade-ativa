'use strict';

const TABLE = 'comunidad_miembros';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          INSERT INTO ${TABLE} (
            user_id,
            comunidad_id,
            rol_comunidad,
            estado,
            es_principal,
            created_at,
            updated_at
          )
          SELECT
            c.owner_user_id,
            c.id,
            'admin_basic',
            'activo',
            CASE
              WHEN u.comunidad_id = c.id THEN true
              ELSE false
            END,
            NOW(),
            NOW()
          FROM comunidades c
          INNER JOIN users u
            ON u.id = c.owner_user_id
          LEFT JOIN ${TABLE} cm
            ON cm.user_id = c.owner_user_id
           AND cm.comunidad_id = c.id
          WHERE c.owner_user_id IS NOT NULL
            AND cm.user_id IS NULL
        `,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `
          UPDATE ${TABLE} cm
          SET
            rol_comunidad = 'admin_basic',
            estado = 'activo',
            updated_at = NOW()
          FROM comunidades c
          WHERE c.owner_user_id IS NOT NULL
            AND c.owner_user_id = cm.user_id
            AND c.id = cm.comunidad_id
            AND (
              cm.rol_comunidad <> 'admin_basic'
              OR cm.estado <> 'activo'
            )
        `,
        { transaction }
      );
    });
  },

  down: async () => {
    // Reparacion de datos no reversible de forma segura.
  },
};
