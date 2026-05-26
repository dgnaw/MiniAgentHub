const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database'); 

const ChatSession = sequelize.define('ChatSession', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false }, 
    title: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Cuộc trò chuyện mới' },
    is_archived: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'chat_sessions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ChatSession;
