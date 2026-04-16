/**
 * controllers/modelsController.js
 * Upload e análise de cartas-modelo em PDF
 */

const { processarModelosPDF } = require('../services/pdfService');
const { modelos } = require('../services/store');

async function uploadModelos(req, res, next) {
  try {
    const arquivos = req.files || (req.file ? [req.file] : []);
    if (!arquivos.length) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    const processados = await processarModelosPDF(arquivos);
    modelos.push(...processados);

    res.json({
      success: true,
      message: `${processados.length} modelo(s) processado(s) com sucesso.`,
      files: processados.map((m) => ({
        nome: m.nome,
        tamanho: m.tamanho,
        preview: m.preview,
      })),
      totalModelos: modelos.length,
    });
  } catch (err) {
    next(err);
  }
}

function analisarModelos(_req, res) {
  res.json({
    success: true,
    message: 'Análise concluída.',
    totalAnalisado: modelos.length,
    pontos: modelos.length > 0
      ? [`${modelos.length} modelo(s) carregados e prontos para uso como referência.`]
      : ['Nenhum modelo carregado ainda.'],
  });
}

module.exports = { uploadModelos, analisarModelos };
