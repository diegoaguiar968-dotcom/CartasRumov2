// routes/export.js
const router = require('express').Router();
const { exportarDocx, exportarPdf } = require('../controllers/exportController');

router.post('/docx', exportarDocx);
router.post('/pdf', exportarPdf);

module.exports = router;
