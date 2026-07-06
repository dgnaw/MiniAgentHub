const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');


router.get('/chat-sessions', chatController.getSessions);
router.get('/chat-sessions/:id/messages', chatController.getSessionMessages);
router.delete('/chat-sessions', chatController.deleteAllSessions);
router.delete('/chat-sessions/:id', chatController.deleteSession);
router.put('/chat-sessions/:id', chatController.renameSession);
router.put('/chat-sessions/:id/truncate-last-message', chatController.truncateLastAIMessage);
router.put('/chat-sessions/:id/share', chatController.shareSession);
router.get('/public/chat-sessions/:id', chatController.getPublicSession);

module.exports = router;