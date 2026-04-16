// routes/minuta.js
const router = require('express').Router();
const { gerarMinutaHandler } = require('../controllers/minutaController');

router.post('/generate', gerarMinutaHandler);

module.exports = router;
