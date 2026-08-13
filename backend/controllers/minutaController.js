/**
 * controllers/minutaController.js
 * Geração da minuta de resposta ao ofício via Claude
 */

const fs = require('fs');
const path = require('path');
const { gerarMinuta, refinarMinuta, gerarCartaEspontanea, gerarAssuntoCurto } = require('../services/claudeService');
const { getTemplate } = require('../services/docxTemplates');
const { getSession, modelosPermanentes } = require('../services/store');

// Remove markdown artifacts e prefixos indesejados gerados pela IA
function limparMarkdown(texto) {
  return texto
    .replace(/\*\*(.+?)\*\*/gs, '$1')          // **negrito** → texto
    .replace(/\*(.+?)\*/gs, '$1')              // *itálico* → texto
    .replace(/^#{1,6}\s+/gm, '')               // ## Título → Título
    .replace(/^---+\s*$/gm, '')                // linhas --- → removidas
    .replace(/^___+\s*$/gm, '')                // linhas ___ → removidas
    .replace(/^minuta\s+refinada[:\s]*/im, '') // "Minuta Refinada:" → removido
    .replace(/^minuta[:\s]+/im, '')            // "Minuta:" → removido
    .replace(/\n{3,}/g, '\n\n')                // 3+ quebras → 2 quebras
    .trim();
}

// Separa nome e cargo do signatário da ANTT (ex: "Nome - Cargo")
function parsearSignatarioAntt(signatarioAntt) {
  if (!signatarioAntt) return { nome: '', cargo: '' };
  const dashIdx = signatarioAntt.indexOf(' - ');
  if (dashIdx > 0) {
    return {
      nome: signatarioAntt.substring(0, dashIdx).trim(),
      cargo: signatarioAntt.substring(dashIdx + 3).trim(),
    };
  }
  const parts = signatarioAntt.split('\n');
  if (parts.length >= 2) return { nome: parts[0].trim(), cargo: parts.slice(1).join(' ').trim() };
  return { nome: signatarioAntt.trim(), cargo: '' };
}

// Detecta tratamento (Sr./Sra.) pelo primeiro nome
function tratamento(nome) {
  if (!nome) return '';
  const primeiro = nome.split(' ')[0].toLowerCase();
  return /[aei]$/i.test(primeiro) ? 'Sra.' : 'Sr.';
}

async function gerarMinutaHandler(req, res, next) {
  try {
    const session = getSession(req.sessionId);
    const modeloId = req.body.modeloId || 'objetiva';
    const template = getTemplate(modeloId);

    let briefing = req.body.briefing;
    if (!briefing) {
      const ultimoOficio = session.oficios[session.oficios.length - 1];
      if (ultimoOficio?.briefing) {
        briefing = ultimoOficio.briefing;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Dados do briefing são obrigatórios. Processe o ofício na Etapa 2 primeiro.',
        });
      }
    }

    // Aceita pontos como string (formato antigo) ou objeto. A "resposta" é a
    // orientação editada pelo usuário — pode vir como `sugestao` se o cliente
    // enviar o ponto sem alterações.
    const rawPontos = req.body.pontosRespondidos || req.body.pontos || [];
    const pontosRespondidos = rawPontos
      .map((item) => (typeof item === 'string' ? { ponto: item } : item || {}))
      .map((item) => ({
        ponto: (item.ponto || item.pergunta || '').trim(),
        resposta: (item.resposta || item.sugestao || '').trim(),
      }))
      .filter((item) => item.ponto);

    const textoModelosReferencia = [...modelosPermanentes, ...session.modelos]
      .map((m) => m.textoExtraido)
      .join('\n\n---\n\n')
      .substring(0, 8000);

    console.log('[Minuta] Gerando com Claude...');

    const templatePath = template.arquivo
      ? path.join(__dirname, '../templates', template.arquivo)
      : null;
    const usaTemplate = !!(templatePath && fs.existsSync(templatePath));

    const { texto: textoRaw, feedback } = await gerarMinuta({
      briefing, pontosRespondidos,
      textoModelosReferencia, templateHint: template.claudeHint, usaTemplate,
      contextosAdicionais: session.documentosComplementares.length ? [...session.documentosComplementares] : undefined,
    });

    const textoMinuta = limparMarkdown(textoRaw);
    console.log('[Minuta] Gerada com sucesso.');

    const { nome: nomeAntt, cargo: cargoAntt } = parsearSignatarioAntt(briefing?.signatarioAntt);

    session.ultimaMinuta.texto        = textoMinuta;
    session.ultimaMinuta.modeloId     = modeloId;
    session.ultimaMinuta.signatarioAntt = nomeAntt ? `${tratamento(nomeAntt)} ${nomeAntt}` : '';
    session.ultimaMinuta.cargoAntt    = cargoAntt;
    session.ultimaMinuta.malha        = briefing?.malha || '';
    session.ultimaMinuta.processo     = briefing?.processo || '';
    session.ultimaMinuta.assunto      = briefing?.assunto || `Atendimento ao ${briefing?.numero || 'ofício da ANTT'}`;
    session.ultimaMinuta.referencia   = briefing?.numero || '';

    res.json({
      success: true,
      message: 'Minuta gerada com sucesso.',
      minuta: textoMinuta,
      texto: textoMinuta,
      conteudo: textoMinuta,
      documento: textoMinuta,
      resposta: textoMinuta,
      content: textoMinuta,
      feedback,
      meta: {
        signatarioAntt: session.ultimaMinuta.signatarioAntt,
        cargoAntt:      session.ultimaMinuta.cargoAntt,
        malha:          session.ultimaMinuta.malha,
        assunto:        session.ultimaMinuta.assunto,
        processo:       session.ultimaMinuta.processo,
        referencia:     session.ultimaMinuta.referencia,
        modeloId:       session.ultimaMinuta.modeloId,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function refinarMinutaHandler(req, res, next) {
  try {
    const session = getSession(req.sessionId);
    const { textoAtual, mensagem, historico } = req.body;
    if (!textoAtual) return res.status(400).json({ success: false, message: 'textoAtual é obrigatório.' });
    if (!mensagem?.trim()) return res.status(400).json({ success: false, message: 'mensagem é obrigatória.' });

    console.log('[Refinar] Refinando minuta com Claude...');
    const { texto: textoRaw, feedback } = await refinarMinuta({
      textoAtual, mensagem: mensagem.trim(), historico: historico || [],
    });
    const textoRefinado = limparMarkdown(textoRaw);

    session.ultimaMinuta.texto = textoRefinado;
    res.json({ success: true, texto: textoRefinado, minuta: textoRefinado, feedback });
  } catch (err) {
    next(err);
  }
}

async function gerarCartaEspontaneaHandler(req, res, next) {
  try {
    const session = getSession(req.sessionId);
    const { modeloId, destinatario, cargoDestinatario, area, malha: malhaKey, referencia, processo, assunto } = req.body;

    if (!assunto?.trim()) {
      return res.status(400).json({ success: false, message: 'O campo assunto é obrigatório.' });
    }
    if (!malhaKey) {
      return res.status(400).json({ success: false, message: 'Selecione a malha Rumo respondente.' });
    }

    const template = getTemplate(modeloId || 'documentacao');
    const templatePath = template.arquivo ? path.join(__dirname, '../templates', template.arquivo) : null;
    const usaTemplate = !!(templatePath && fs.existsSync(templatePath));

    const textoModelosReferencia = [...modelosPermanentes, ...session.modelos]
      .map(m => m.textoExtraido).join('\n\n---\n\n').substring(0, 8000);

    const { texto: textoRaw, feedback } = await gerarCartaEspontanea({
      malha: malhaKey, destinatario, cargoDestinatario, area,
      referencia: referencia?.trim() || '',
      processo: processo?.trim() || '',
      assunto,
      textoModelosReferencia,
      templateHint: template.claudeHint,
      usaTemplate,
      contextosAdicionais: session.documentosComplementares.length ? [...session.documentosComplementares] : undefined,
    });

    const textoMinuta = limparMarkdown(textoRaw);

    const { resolverMalhas, gerarTextoMalhas } = require('../services/malhas');
    const textoMalhas = gerarTextoMalhas(resolverMalhas(malhaKey));
    const assuntoCurto = await gerarAssuntoCurto(assunto, textoMalhas?.nomesResumidos || '');

    session.ultimaMinuta.texto         = textoMinuta;
    session.ultimaMinuta.modeloId      = modeloId || 'documentacao';
    session.ultimaMinuta.signatarioAntt = destinatario ? `${tratamento(destinatario)} ${destinatario}` : '';
    session.ultimaMinuta.cargoAntt     = cargoDestinatario || '';
    session.ultimaMinuta.malha         = malhaKey || '';
    session.ultimaMinuta.processo      = processo?.trim() || '';
    session.ultimaMinuta.assunto       = assuntoCurto;
    session.ultimaMinuta.referencia    = referencia?.trim() || '';

    res.json({
      success: true,
      minuta: textoMinuta,
      texto: textoMinuta,
      feedback,
      meta: {
        signatarioAntt: session.ultimaMinuta.signatarioAntt,
        cargoAntt:      session.ultimaMinuta.cargoAntt,
        malha:          session.ultimaMinuta.malha,
        assunto:        session.ultimaMinuta.assunto,
        processo:       session.ultimaMinuta.processo,
        referencia:     session.ultimaMinuta.referencia,
        modeloId:       session.ultimaMinuta.modeloId,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { gerarMinutaHandler, refinarMinutaHandler, gerarCartaEspontaneaHandler };
