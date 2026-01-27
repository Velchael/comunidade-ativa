module.exports = (sequelize, DataTypes) => {
  const GrupoActivo = sequelize.define('GrupoActivo', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    comunidad_id: { type: DataTypes.INTEGER, allowNull: false },
    lider_id: { type: DataTypes.INTEGER, allowNull: false },
    colider_id: { type: DataTypes.INTEGER, allowNull: true },
    colider_nombre: { type: DataTypes.STRING, allowNull: true },
    anfitrion_nombre: { type: DataTypes.STRING, allowNull: true },
    direccion_grupo: { type: DataTypes.TEXT, allowNull: false },
  }, {
    tableName: 'grupos_activos',
    createdAt: 'creado_en',
    updatedAt: 'actualizado_en'
  });

  GrupoActivo.associate = (models) => {
    GrupoActivo.belongsTo(models.Usuario, { foreignKey: 'colider_id', as: 'colider' });
    GrupoActivo.belongsTo(models.Usuario, { foreignKey: 'lider_id', as: 'lider' });
    GrupoActivo.belongsTo(models.Comunidad, { foreignKey: 'comunidad_id', as: 'comunidad' });
  };

  return GrupoActivo;
};
