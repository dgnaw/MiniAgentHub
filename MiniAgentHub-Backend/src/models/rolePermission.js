const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RolePermission = sequelize.define('RolePermission', {
    role_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'roles',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    permission_id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
            model: 'permissions', 
            key: 'id',
        },
        onDelete: 'CASCADE',
    }
}, {
    tableName: 'role_permissions',
    
    timestamps: false,
});

module.exports = RolePermission;