const User = require('./user');
const Role = require('./role');
const Group = require('./group');
const UserGroup = require('./userGroup');
const Permission = require('./permission');
const RolePermission = require('./rolePermission');
const GroupPermission = require('./groupPermission');
const ChatSession = require('./chatSession');
const ChatMessage = require('./chatMessage');

User.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(User, { foreignKey: 'role_id' });

User.belongsToMany(Group, { through: UserGroup, foreignKey: 'user_id' });
Group.belongsToMany(User, { through: UserGroup, foreignKey: 'group_id' });

Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id' });

Group.belongsToMany(Permission, { through: GroupPermission, foreignKey: 'group_id' });
Permission.belongsToMany(Group, { through: GroupPermission, foreignKey: 'permission_id' });

// Thiết lập quan hệ cho tính năng AI Chat
User.hasMany(ChatSession, { foreignKey: 'user_id' });
ChatSession.belongsTo(User, { foreignKey: 'user_id' });

ChatSession.hasMany(ChatMessage, { foreignKey: 'session_id' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'session_id' });

module.exports = {
    User,
    Role,
    Group,
    UserGroup,
    Permission,
    RolePermission,
    GroupPermission,
    ChatSession,
    ChatMessage
};
