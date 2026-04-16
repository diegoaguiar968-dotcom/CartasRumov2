// routes/models.js
const router = require('express').Router();
const upload = require('../middleware/upload');
const { uploadModelos, analisarModelos } = require('../controllers/modelsController');

router.post('/upload', upload.array('files', 5), uploadModelos);
router.get('/analyze', analisarModelos);
router.post('/analyze', analisarModelos);

module.exports = router;
