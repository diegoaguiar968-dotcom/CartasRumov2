// routes/minuta.js
const router = require('express').Router();
const { gerarMinutaHandler } = require('../controllers/minutaController');

router.post('/generate', gerarMinutaHandler);
router.get('/generate', gerarMinutaHandler); // compatibilidade com frontend

module.exports = router;
