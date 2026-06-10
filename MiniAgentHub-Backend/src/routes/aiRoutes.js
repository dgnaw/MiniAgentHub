const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Khởi tạo thư mục chứa file tạm

router.post('/chat', authenticateToken, upload.single('file'), aiController.chat);
router.get('/chat-sessions', authenticateToken, aiController.getSessions);
router.get('/chat-sessions/:id/messages', authenticateToken, aiController.getSessionMessages);
router.delete('/chat-sessions', authenticateToken, aiController.deleteAllSessions);
router.delete('/chat-sessions/:id', authenticateToken, aiController.deleteSession);
router.put('/chat-sessions/:id', authenticateToken, aiController.renameSession);
module.exports = router;
