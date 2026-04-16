/**
 * controllers/modelsController.js
 * Upload e análise de cartas-modelo em PDF
 */

const { processarModelosPDF } = require('../services/pdfService');
const { modelos } = require('../services/store');

const LIMITE_MODELOS_STORE = 5;
const LIMITE_UPLOAD = 5;

async function uploadModelos(req, res, next) {
  try {
    const arquivos = req.files || (req.file ? [req.file] : []);

    if (!arquivos.length) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    if (arquivos.length > LIMITE_UPLOAD) {
      return res.status(400).json({
        success: false,
        message: `Envie no máximo ${LIMITE_UPLOAD} arquivos por vez. Você enviou ${arquivos.length}.`,
      });
    }

    const processados = await processarModelosPDF(arquivos);

    // Mantém apenas os modelos mais recentes até o limite do store
    // Remove os mais antigos para dar lugar aos novos
    const totalAposInsercao = modelos.length + processados.length;
    if (totalAposInsercao > LIMITE_MODELOS_STORE) {
      const remover = totalAposInsercao - LIMITE_MODELOS_STORE;
      modelos.splice(0, remover);
    }
    modelos.push(...processados);

    const avisos = [];
    if (modelos.length === LIMITE_MODELOS_STORE) {
      avisos.push(
        `O banco de modelos está no limite máximo de ${LIMITE_MODELOS_STORE} arquivos. Os mais antigos foram substituídos automaticamente.`
      );
    }
    avisos.push(
      `Dica: envie no máximo ${LIMITE_UPLOAD} PDFs por vez para melhor aproveitamento. Arquivos além do 3º têm impacto reduzido na geração.`
    );

    res.json({
      success: true,
      message: `${processados.length} modelo(s) processado(s) com sucesso.`,
      files: processados.map((m) => ({ nome: m.nome, tamanho: m.tamanho, preview: m.preview })),
      totalModelos: modelos.length,
      limiteModelos: LIMITE_MODELOS_STORE,
      avisos,
    });
  } catch (err) {
    next(err);
  }
}

function analisarModelos(_req, res) {
  const avisos = [];
  if (modelos.length === 0) {
    avisos.push('Nenhum modelo carregado ainda.');
  } else if (modelos.length >= 3) {
    avisos.push(
      `${modelos.length} modelo(s) carregados. Para melhores resultados, use no máximo ${LIMITE_MODELOS_STORE}.`
    );
  }

  res.json({
    success: true,
    message: 'Análise concluída.',
    totalAnalisado: modelos.length,
    limiteModelos: LIMITE_MODELOS_STORE,
    limiteUpload: LIMITE_UPLOAD,
    pontos:
      modelos.length > 0
        ? [`${modelos.length} modelo(s) carregados e prontos para uso como referência.`, ...avisos]
        : avisos,
  });
}

module.exports = { uploadModelos, analisarModelos };
