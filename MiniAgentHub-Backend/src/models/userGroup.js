const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserGroup = sequelize.define('UserGroup', {
    user_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    group_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'groups',
            key: 'id',
        },
        onDelete: 'CASCADE',
    }
}, {
    tableName: 'user_groups',
    timestamps: false,
});

module.exports = UserGroup;