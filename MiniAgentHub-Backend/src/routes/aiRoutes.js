const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Khởi tạo thư mục chứa file tạm

router.post('/chat', authenticateToken, upload.array('files', 10), aiController.chat); // Giới hạn tối đa 10 files một lần gửi
module.exports = router;
