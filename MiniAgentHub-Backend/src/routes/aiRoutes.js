const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 
router.post('/chat', authenticateToken, upload.array('files', 10), aiController.chat); 
router.get('/models', authenticateToken, aiController.getModels);
module.exports = router;
