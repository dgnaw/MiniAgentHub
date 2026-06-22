const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/chat-sessions', authenticateToken, chatController.getSessions);
router.get('/chat-sessions/:id/messages', authenticateToken, chatController.getSessionMessages);
router.delete('/chat-sessions', authenticateToken, chatController.deleteAllSessions);
router.delete('/chat-sessions/:id', authenticateToken, chatController.deleteSession);
router.put('/chat-sessions/:id', authenticateToken, chatController.renameSession);
router.put('/chat-sessions/:id/share', authenticateToken, chatController.shareSession);
router.get('/public/chat-sessions/:id', chatController.getPublicSession);

module.exports = router;