const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    }
}, {
    tableName: 'roles',
    timestamps: false,
});

module.exports = Role;