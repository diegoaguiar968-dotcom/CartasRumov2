/**
 * controllers/minutaController.js
 * Geração da minuta de resposta ao ofício via Claude
 */

const { gerarMinuta } = require('../services/claudeService');
const { modelos, oficios } = require('../services/store');

async function gerarMinutaHandler(req, res, next) {
  try {
    const { briefing, signatario, cargo, pontosRespondidos } = req.body;

    if (!briefing) {
      return res.status(400).json({
        success: false,
        message: 'Dados do briefing são obrigatórios. Processe o ofício na Etapa 2 primeiro.',
      });
    }

    // Concatena os textos dos modelos carregados para fornecer referência de estilo ao Claude
    const textoModelosReferencia = modelos
      .map((m) => m.textoExtraido)
      .join('\n\n---\n\n')
      .substring(0, 4000); // Limita para não sobrecarregar o contexto

    console.log('[Minuta] Gerando com Claude...');
    console.log(`[Minuta] Modelos de referência: ${modelos.length}`);
    console.log(`[Minuta] Pontos a responder: ${pontosRespondidos?.length || 0}`);

    const textoMinuta = await gerarMinuta({
      briefing,
      signatario,
      cargo,
      pontosRespondidos,
      textoModelosReferencia,
    });

    console.log('[Minuta] Gerada com sucesso.');

    // Retorna em múltiplos campos para compatibilidade com o frontend
    res.json({
      success: true,
      message: 'Minuta gerada com sucesso.',
      minuta: textoMinuta,
      texto: textoMinuta,
      conteudo: textoMinuta,
      documento: textoMinuta,
      resposta: textoMinuta,
      content: textoMinuta,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { gerarMinutaHandler };
