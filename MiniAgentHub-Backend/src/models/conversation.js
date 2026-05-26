const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Conversation = sequelize.define('Conversation', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    owner_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users', 
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    title: {
        type: DataTypes.STRING(255),
        defaultValue: 'New Conversation',
    },
    ai_model: {
        type: DataTypes.STRING(100),
        defaultValue: 'gemini-1.5-flash',
    }
}, {
    tableName: 'conversations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Conversation;