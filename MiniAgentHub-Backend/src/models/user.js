const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    full_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    role_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'roles', 
            key: 'id',
        },
        onDelete: 'SET NULL',
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    is_first_login: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = User;
