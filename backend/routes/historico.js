// routes/historico.js
const router = require('express').Router();
const {
  listarHistorico,
  opcoesFiltro,
  proximoNumero,
  numeroExiste,
  detalheHistorico,
  atualizarHistorico,
  excluirHistorico,
} = require('../controllers/historicoController');
const { exportarHistoricoDocx } = require('../controllers/exportController');

router.get('/', listarHistorico);
router.get('/opcoes', opcoesFiltro);
// rotas fixas ANTES de '/:id' para não serem capturadas como id
router.get('/proximo-numero', proximoNumero);
router.get('/numero-existe', numeroExiste);
router.get('/:id', detalheHistorico);
router.get('/:id/docx', exportarHistoricoDocx);
router.patch('/:id', atualizarHistorico);
router.delete('/:id', excluirHistorico);

module.exports = router;
