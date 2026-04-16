/**
 * controllers/minutaController.js
 * Geração da minuta de resposta ao ofício via Claude
 */

const { gerarMinuta } = require('../services/claudeService');
const { modelos, oficios, ultimaMinuta } = require('../services/store');

async function gerarMinutaHandler(req, res, next) {
  try {
    const { signatario, cargo } = req.body;

    // Aceita 'briefing' do body ou usa o último ofício processado no store
    let briefing = req.body.briefing;
    if (!briefing) {
      const ultimoOficio = oficios[oficios.length - 1];
      if (ultimoOficio?.briefing) {
        briefing = ultimoOficio.briefing;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Dados do briefing são obrigatórios. Processe o ofício na Etapa 2 primeiro.',
        });
      }
    }

    // Aceita 'pontos' (frontend) ou 'pontosRespondidos' (backend), mapeando 'pergunta' → 'ponto'
    const rawPontos = req.body.pontosRespondidos || req.body.pontos || [];
    const pontosRespondidos = rawPontos.map((item) => ({
      ponto: item.ponto || item.pergunta || '',
      resposta: item.resposta || '',
    }));

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

    // Persiste no store para os endpoints GET de export
    ultimaMinuta.texto = textoMinuta;
    ultimaMinuta.signatario = signatario || '';
    ultimaMinuta.cargo = cargo || '';

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
