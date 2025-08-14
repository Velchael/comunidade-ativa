// models/ReunionGrupo.js

module.exports = (sequelize, DataTypes) => {
  const ReunionGrupo = sequelize.define('ReunionGrupo', {
    grupo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'grupos_activos', key: 'id' }
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    tema_compartido: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    asistentes_regulares: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    nuevos_asistentes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    observaciones: {
      type: DataTypes.TEXT
    },
    creado_por: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    }
  }, {
    tableName: 'reuniones_grupo',
    timestamps: true,
    createdAt: 'creado_en',
    updatedAt: false
  });

  ReunionGrupo.associate = (models) => {
    ReunionGrupo.belongsTo(models.GrupoActivo, { foreignKey: 'grupo_id', as: 'grupo' });
    ReunionGrupo.belongsTo(models.Usuario, { foreignKey: 'creado_por', as: 'creador' });
  };

  return ReunionGrupo;
};
