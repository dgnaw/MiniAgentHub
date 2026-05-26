const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    session_id: { type: DataTypes.UUID, allowNull: false }, // Khóa ngoại trỏ tới ChatSession
    role: { type: DataTypes.ENUM('user', 'ai'), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false }
}, {
    tableName: 'chat_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false // Tin nhắn chat xong không cần updated_at
});

module.exports = ChatMessage;
