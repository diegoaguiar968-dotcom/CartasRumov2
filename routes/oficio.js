// routes/oficio.js
const router = require('express').Router();
const upload = require('../middleware/upload');
const { uploadOficio } = require('../controllers/oficioController');

router.post('/upload', upload.single('file'), uploadOficio);
router.post('/analyze', (_req, res) => {
  res.json({ success: true, message: 'Ofício em processamento.' });
});

module.exports = router;
