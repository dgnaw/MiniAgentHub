const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { checkPermission } = require('../middleware/authMiddleware');
const { chatLimiter } = require('../middleware/rateLimiter');
const multer = require('multer');
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/chat', 
    checkPermission('CHAT'), 
    chatLimiter,
    upload.array('files', 10), 
    aiController.chat
);
router.get('/chat/stream/:sessionId', checkPermission('CHAT'), aiController.reconnectStream);
router.get('/models', aiController.getModels);
module.exports = router;
