const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');

const { checkPermission } = require('../middleware/authMiddleware');

router.get('/groups', checkPermission('GROUP_R'), groupController.getAllGroups);

router.post('/groups', checkPermission('GROUP_C'), groupController.createGroup);

router.get('/groups/:id', checkPermission('GROUP_R'), groupController.getGroupById);

router.put('/groups/:id', checkPermission('GROUP_U'), groupController.updateGroup);

router.delete('/groups/:id', checkPermission('GROUP_D'), groupController.deleteGroup);

router.post('/groups/:id/users', checkPermission('GROUP_U'), groupController.addUsersToGroup);

router.delete('/groups/:id/users/:userId', checkPermission('GROUP_U'), groupController.removeUserFromGroup);

module.exports = router;