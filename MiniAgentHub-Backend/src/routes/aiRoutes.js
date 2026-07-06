const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');


const multer = require('multer');
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }
});
router.post('/chat', upload.array('files', 10), aiController.chat);
router.get('/models', aiController.getModels);
module.exports = router;
