const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GroupPermission = sequelize.define('GroupPermission', {
    group_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'groups',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    permission_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'permissions',
            key: 'id',
        },
        onDelete: 'CASCADE',
    }
}, {
    tableName: 'group_permissions',
    timestamps: false,
});

module.exports = GroupPermission;