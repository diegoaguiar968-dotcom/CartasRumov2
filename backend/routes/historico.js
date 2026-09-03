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
const { registrarSharePoint, criarPastaSharePoint, formsUrl } = require('../controllers/sharepointController');
const { uploadLivre } = require('../middleware/upload');

// Anexos da carta: qualquer formato, até 20 arquivos por envio
const anexosCarta = uploadLivre.fields([
  { name: 'anexos', maxCount: 20 },
  { name: 'files', maxCount: 20 },
]);

router.get('/', listarHistorico);
router.get('/opcoes', opcoesFiltro);
// rotas fixas ANTES de '/:id' para não serem capturadas como id
router.get('/proximo-numero', proximoNumero);
router.get('/numero-existe', numeroExiste);
router.get('/:id', detalheHistorico);
router.get('/:id/docx', exportarHistoricoDocx);
router.get('/:id/forms-url', formsUrl);
router.post('/:id/sharepoint', anexosCarta, registrarSharePoint);
router.post('/:id/sharepoint/pasta', anexosCarta, criarPastaSharePoint);
router.patch('/:id', atualizarHistorico);
router.delete('/:id', excluirHistorico);

module.exports = router;
