const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');

const { authenticateToken, checkPermission } = require('../middleware/authMiddleware');

router.get('/groups', authenticateToken, checkPermission('GROUP_R'), groupController.getAllGroups);

router.post('/groups', authenticateToken, checkPermission('GROUP_C'), groupController.createGroup);

router.get('/groups/:id', authenticateToken, checkPermission('GROUP_R'), groupController.getGroupById);

router.put('/groups/:id', authenticateToken, checkPermission('GROUP_U'), groupController.updateGroup);

router.delete('/groups/:id', authenticateToken, checkPermission('GROUP_D'), groupController.deleteGroup);

router.post('/groups/:id/users', authenticateToken, checkPermission('GROUP_U'), groupController.addUsersToGroup);

router.delete('/groups/:id/users/:userId', authenticateToken, checkPermission('GROUP_U'), groupController.removeUserFromGroup);

module.exports = router;