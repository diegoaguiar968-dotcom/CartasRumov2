/**
 * controllers/oficioController.js
 * Upload do ofício da ANTT e extração inteligente de dados via Claude
 */

const { extrairTextoPDF, textoEhLegivel } = require('../services/pdfService');
const { extrairTextoArquivo } = require('../services/fileTextService');
const { extrairBriefingOficio, extrairBriefingOficioPDF } = require('../services/claudeService');
const { getSession } = require('../services/store');

// IDs únicos mesmo para arquivos enviados no mesmo milissegundo
let contadorId = 0;
function proximoId() {
  contadorId += 1;
  return Date.now() * 1000 + (contadorId % 1000);
}

async function uploadOficio(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    const session = getSession(req.sessionId);

    console.log('[Ofício] Extraindo texto do PDF...');
    const textoOficio = await extrairTextoPDF(req.file.path);

    let briefing;
    if (textoEhLegivel(textoOficio)) {
      console.log('[Ofício] Texto legível — extraindo briefing via texto...');
      briefing = await extrairBriefingOficio(textoOficio);
    } else {
      console.log('[Ofício] Texto ilegível (PDF com codificação especial ou escaneado) — usando leitura nativa de PDF pelo Claude...');
      briefing = await extrairBriefingOficioPDF(req.file.path);
    }

    // Novo ofício: limpa documentos complementares da sessão anterior
    session.documentosComplementares.splice(0);

    // Armazena para uso posterior na geração da minuta
    const oficio = {
      id: Date.now(),
      nome: req.file.originalname,
      texto: textoOficio,
      briefing,
      dataProcessamento: new Date().toISOString(),
    };
    session.oficios.push(oficio);

    console.log('[Ofício] Briefing extraído com sucesso:', briefing.numero);

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

/**
 * Recebe um ou vários documentos complementares, em qualquer formato.
 * Aceita os campos `files` (novo, múltiplo) e `file` (antigo, único).
 * Formatos sem leitura automática são registrados apenas pelo nome — a IA
 * fica sabendo que o documento acompanha o ofício.
 */
async function uploadComplementar(req, res, next) {
  try {
    const enviados = [
      ...(req.files?.files || []),
      ...(req.files?.file || []),
      ...(req.file ? [req.file] : []),
    ];

    if (!enviados.length) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });
    }

    const session = getSession(req.sessionId);
    const documentos = [];

    for (const arquivo of enviados) {
      const resultado = await extrairTextoArquivo(arquivo.path, arquivo.originalname);
      const doc = {
        id: proximoId(),
        nome: arquivo.originalname,
        texto: resultado.texto,
        formato: resultado.formato,
        extraido: resultado.extraido,
        motivo: resultado.motivo,
      };
      session.documentosComplementares.push(doc);
      documentos.push({
        id: doc.id,
        nome: doc.nome,
        formato: doc.formato,
        extraido: doc.extraido,
        motivo: doc.motivo,
      });
      console.log(
        `[Complementar] ${doc.nome} (${doc.formato}) — ${doc.extraido ? `${doc.texto.length} chars` : 'sem leitura de conteúdo'}`
      );
    }

    console.log(`[Complementar] ${session.documentosComplementares.length} documento(s) na sessão.`);
    // `id`/`nome` no topo mantêm compatibilidade com o cliente antigo (envio único)
    res.json({ success: true, documentos, id: documentos[0].id, nome: documentos[0].nome });
  } catch (err) {
    next(err);
  }
}

function removeComplementar(req, res) {
  const session = getSession(req.sessionId);
  const id = parseInt(req.params.id, 10);
  const idx = session.documentosComplementares.findIndex(d => d.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Documento não encontrado.' });
  session.documentosComplementares.splice(idx, 1);
  res.json({ success: true });
}

module.exports = { uploadOficio, uploadComplementar, removeComplementar };
