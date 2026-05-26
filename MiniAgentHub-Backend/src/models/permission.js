const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Permission = sequelize.define('Permission', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    permission_key: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'permissions',
    timestamps: false, 
});

module.exports = Permission;