const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/chat', authenticateToken, aiController.chat);
router.get('/chat-sessions', authenticateToken, aiController.getSessions);
router.get('/chat-sessions/:id/messages', authenticateToken, aiController.getSessionMessages);
router.delete('/chat-sessions', authenticateToken, aiController.deleteAllSessions);

module.exports = router;
