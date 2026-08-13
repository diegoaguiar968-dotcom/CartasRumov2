// routes/models.js
const router = require('express').Router();
const { uploadPdf: upload } = require('../middleware/upload');
const { uploadModelos, analisarModelos, listarTemplates } = require('../controllers/modelsController');

router.get('/templates', listarTemplates);
router.post('/upload', upload.array('files', 5), uploadModelos);
router.get('/analyze', analisarModelos);
router.post('/analyze', analisarModelos);

module.exports = router;
