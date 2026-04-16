/**
 * controllers/oficioController.js
 * Upload do ofício da ANTT e extração inteligente de dados via Claude
 */

const { extrairTextoPDF } = require('../services/pdfService');
const { extrairBriefingOficio } = require('../services/claudeService');
const { oficios } = require('../services/store');

async function uploadOficio(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    console.log('[Ofício] Extraindo texto do PDF...');
    const textoOficio = await extrairTextoPDF(req.file.path);

    console.log('[Ofício] Enviando para Claude extrair briefing...');
    const briefing = await extrairBriefingOficio(textoOficio);

    // Armazena para uso posterior na geração da minuta
    const oficio = {
      id: Date.now(),
      nome: req.file.originalname,
      texto: textoOficio,
      briefing,
      dataProcessamento: new Date().toISOString(),
    };
    oficios.push(oficio);

    console.log('[Ofício] Briefing extraído com sucesso:', briefing.numero);

    // Resposta com o briefing em múltiplos campos para compatibilidade com o frontend
    res.json({
      success: true,
      message: 'Ofício processado com sucesso.',
      briefing,
      analise: briefing,
      content: {
        texto: textoOficio.substring(0, 3000),
        briefing,
        nomeArquivo: req.file.originalname,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadOficio };
