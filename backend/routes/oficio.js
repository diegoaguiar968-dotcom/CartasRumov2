const router = require('express').Router();
const { uploadPdf, uploadLivre } = require('../middleware/upload');
const { uploadOficio, uploadComplementar, removeComplementar } = require('../controllers/oficioController');

// O ofício principal é sempre PDF (é o que a ANTT emite via SEI).
router.post('/upload', uploadPdf.single('file'), uploadOficio);
// Complementares: vários arquivos por vez, em qualquer formato.
// `files` (plural) é o campo novo; `file` segue aceito por retrocompatibilidade.
router.post(
  '/complementar',
  uploadLivre.fields([{ name: 'files', maxCount: 10 }, { name: 'file', maxCount: 10 }]),
  uploadComplementar
);
router.delete('/complementar/:id', removeComplementar);
router.get('/upload', (_req, res) => {
  res.json({ success: true, message: 'Rota de ofício ativa. Use POST para enviar o PDF.' });
});
router.post('/analyze', (_req, res) => {
  res.json({ success: true, message: 'Ofício em processamento.' });
});
router.get('/analyze', (_req, res) => {
  res.json({ success: true, message: 'Ofício em processamento.' });
});

module.exports = router;
