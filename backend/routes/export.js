// routes/export.js
const router = require('express').Router();
const { exportarDocx, exportarPdf } = require('../controllers/exportController');

router.post('/docx', exportarDocx);
router.get('/docx', exportarDocx);   // frontend acessa via GET usando a última minuta do store

router.post('/pdf', exportarPdf);
router.get('/pdf', exportarPdf);     // frontend acessa via GET usando a última minuta do store

module.exports = router;
