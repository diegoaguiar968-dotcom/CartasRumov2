// routes/antt.js
const router = require('express').Router();
const { carregar } = require('../services/anttService');

// GET /api/antt/servidores — base de referência (superintendências + servidores)
router.get('/servidores', (_req, res) => {
  const dados = carregar();
  res.json({
    success: true,
    fonte: dados.fonte,
    atualizadoEm: dados.atualizadoEm,
    superintendencias: dados.superintendencias || [],
    servidores: dados.servidores || [],
  });
});

module.exports = router;
