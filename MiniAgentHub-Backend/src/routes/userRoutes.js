const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

const { authenticateToken, checkPermission } = require('../middleware/authMiddleware');

router.get('/users', authenticateToken, checkPermission('USER_R'), userController.getAllUsers);

router.post('/users', authenticateToken, checkPermission('USER_C'), userController.createUser);

router.put('/users/change-password', authenticateToken, userController.changePassword);

router.get('/users/:id', authenticateToken, checkPermission('USER_R'), userController.getUserById);

router.put('/users/:id', authenticateToken, checkPermission('USER_U'), userController.updateUser);

router.delete('/users/:id', authenticateToken, checkPermission('USER_D'), userController.deleteUser);

module.exports = router;