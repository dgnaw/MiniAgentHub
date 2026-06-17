const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Khởi tạo thư mục chứa file tạm

router.post('/chat', authenticateToken, upload.single('file'), aiController.chat);
module.exports = router;
