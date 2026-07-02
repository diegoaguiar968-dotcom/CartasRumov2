// routes/historico.js
const router = require('express').Router();
const {
  listarHistorico,
  opcoesFiltro,
  detalheHistorico,
  atualizarHistorico,
  excluirHistorico,
} = require('../controllers/historicoController');
const { exportarHistoricoDocx } = require('../controllers/exportController');

router.get('/', listarHistorico);
router.get('/opcoes', opcoesFiltro);
router.get('/:id', detalheHistorico);
router.get('/:id/docx', exportarHistoricoDocx);
router.patch('/:id', atualizarHistorico);
router.delete('/:id', excluirHistorico);

module.exports = router;
