// src/models/Reporte.js
module.exports = (sequelize, DataTypes) => {
  const Reporte = sequelize.define('Reporte', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    
    grupo_id: { type: DataTypes.INTEGER, allowNull: false },
    creador_id: { type: DataTypes.INTEGER, allowNull: false },

    semana: { type: DataTypes.DATE, allowNull: false }, // inicio de semana
    
    asistencia: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0 } },
    tema: { type: DataTypes.STRING, allowNull: false },
    observaciones: { type: DataTypes.TEXT },

    fecha_creacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    fecha_actualizacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'reportes',
    createdAt: 'fecha_creacion',
    updatedAt: 'fecha_actualizacion',
    indexes: [
      {
        unique: true,
        fields: ['grupo_id', 'semana'] // 🔒 garantiza un reporte por semana por grupo
      }
    ]
  });

  // asociaciones
  Reporte.associate = (models) => {
    Reporte.belongsTo(models.GrupoActivo, { foreignKey: 'grupo_id', as: 'grupo' });
    Reporte.belongsTo(models.Usuario, { foreignKey: 'creador_id', as: 'creador' });
  };

  return Reporte;
};
