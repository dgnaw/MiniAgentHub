const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');


const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); 
router.post('/chat', upload.array('files', 10), aiController.chat); 
router.get('/models', aiController.getModels);
module.exports = router;
