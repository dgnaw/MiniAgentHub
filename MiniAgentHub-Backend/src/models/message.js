const { Sequelize } = require('../config/database');

const { DataTypes } = require('sequelize');

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    conversation_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'conversations',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    role: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
},{
    'tableName': 'messages',
    'timestamps': true,
    'createdAt': 'created_at',
    'updatedAt': false,
})