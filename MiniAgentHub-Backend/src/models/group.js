const { sequelize } = require('../config/database');
const { DataTypes } = require('sequelize');

const Group = sequelize.define('Group', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
},{
    'tableName': 'groups',
    'timestamps': true,
    'createdAt': 'created_at',
    'updatedAt': false,
});

module.exports = Group;