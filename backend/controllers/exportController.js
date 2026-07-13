/**
 * controllers/exportController.js
 * Exportação da minuta para DOCX (via template)
 */

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {
  Document, Paragraph, TextRun, AlignmentType, HeadingLevel, Packer,
} = require('docx');
const { getSession } = require('../services/store');
const { getTemplate } = require('../services/docxTemplates');
const { MALHAS, resolverMalhas, gerarTextoMalhas } = require('../services/malhas');
const { salvarHistorico } = require('./historicoController');

function resolverConteudo(req, ultimaMinuta) {
  const body = req.body || {};
  const dadosResposta = body.dadosResposta || {};
  const conteudo =
    dadosResposta.minuta || dadosResposta.conteudo || dadosResposta.texto ||
    body.texto || body.conteudo || ultimaMinuta.texto || '';
  return { conteudo };
}

// Infere saudação pelo prefixo "Sr."/"Sra." já atribuído ao signatário,
// com fallback na terminação do cargo.
function inferirSaudacao(signatarioAntt, cargoAntt) {
  if (/^Sra\./i.test((signatarioAntt || '').trim())) return 'Prezada Senhora,';
  if (/^Sr\./i.test((signatarioAntt || '').trim())) return 'Prezado Senhor,';

  // Fallback: primeira palavra do cargo
  const primeiraWordo = (cargoAntt || '').split(/[\s/,-]/)[0].toLowerCase();
  const neutros = /nte$|ste$|ife$|efe$|ista$/;
  if (primeiraWordo.endsWith('a') && !neutros.test(primeiraWordo)) return 'Prezada Senhora,';

  return 'Prezado Senhor,';
}

// ── Helpers para montagem do corpo em XML (títulos, negrito da empresa) ──
function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Detecta títulos/subtítulos numerados: "1. ", "1.2 ", "2) ", "I. ", "II – "
function ehTituloParagrafo(texto) {
  return /^\s*(?:\d{1,2}(?:\.\d{1,2})*|[IVXLC]{1,5})\s*[.)–-]\s+\S/.test((texto || '').trim());
}

// Monta os <w:r> de um parágrafo normal, aplicando negrito nos nomes de empresa.
function runsCorpo(texto, rPrNormal, rPrBold, nomes) {
  const validos = (nomes || []).filter(Boolean);
  if (!validos.length) {
    return `<w:r>${rPrNormal}<w:t xml:space="preserve">${escXml(texto)}</w:t></w:r>`;
  }
  const re = new RegExp('(' + validos.map(escRegExp).join('|') + ')', 'g');
  return texto.split(re).filter((p) => p !== '').map((p) => {
    const rPr = validos.includes(p) ? rPrBold : rPrNormal;
    return `<w:r>${rPr}<w:t xml:space="preserve">${escXml(p)}</w:t></w:r>`;
  }).join('');
}

function sanitizeNome(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/[^a-zA-Z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

// Malhas operantes (as 5 concessionárias, fora o holding RSA)
const MALHAS_OPERANTES = ['norte', 'paulista', 'oeste', 'sul', 'central'];

function siglaMalhaDe(malhaKey) {
  const malhas = resolverMalhas(malhaKey);
  if (malhas.length === 0) return '';
  const keys = String(malhaKey || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  // Se todas as 5 malhas operantes estiverem selecionadas → "Todas as malhas"
  if (MALHAS_OPERANTES.every(k => keys.includes(k))) return 'Todas as malhas';
  return malhas.map(m => m.sigla).join(', ');
}

// Gera nome do arquivo: $numero$ - GREG - $ano$ - $assunto$ - $malha$
function gerarNomeArquivo(numero, assunto, malhaKey) {
  const seq = (numero || '').replace(/\D/g, '').padStart(4, '0') || '0000';
  const ano = new Date().getFullYear();
  const assuntoSanitized = sanitizeNome(assunto) || 'Carta';
  const siglaMalha = siglaMalhaDe(malhaKey);

  // O assunto gerado pela IA costuma já terminar com a(s) sigla(s) da entidade
  // (ex: "Dilação de Prazo - COE - RMP" ou "... - RMN e RMP") — evita duplicar
  // no nome do arquivo, independentemente do separador usado ("e", ",", etc.).
  const alvo = assuntoSanitized.toUpperCase();
  let assuntoJaTemSigla = false;
  if (siglaMalha === 'Todas as malhas') {
    assuntoJaTemSigla = /TODAS AS MALHAS/.test(alvo);
  } else if (siglaMalha) {
    const siglas = siglaMalha.split(',').map(s => s.trim()).filter(Boolean);
    assuntoJaTemSigla = siglas.every(sig => new RegExp(`\\b${sig}\\b`).test(alvo));
  }

  return siglaMalha && !assuntoJaTemSigla
    ? `${seq} - GREG - ${ano} - ${assuntoSanitized} - ${siglaMalha}.docx`
    : `${seq} - GREG - ${ano} - ${assuntoSanitized}.docx`;
}

// Número da carta no padrão da lista do SharePoint: NNNN/GREG/AAAA
function gerarTituloCarta(numero) {
  const seq = (numero || '').replace(/\D/g, '').padStart(4, '0') || '0000';
  return `${seq}/GREG/${new Date().getFullYear()}`;
}

/**
 * Gera o buffer do DOCX a partir dos dados da carta.
 * Reutilizado tanto pelo export normal quanto pela re-geração via histórico.
 * @returns {{ buffer: Buffer, nomeArquivo: string }}
 */
async function gerarDocxBuffer(dados) {
  const {
    conteudo, numeroOficio = '', signatarioAntt = '', cargoAntt = '',
    malhaKey = '', assunto = '', processo = '', referencia = '', modeloId = 'objetiva',
  } = dados;

  const template = getTemplate(modeloId);
  const templatePath = template.arquivo
    ? path.join(__dirname, '../templates', template.arquivo)
    : null;

  if (templatePath && fs.existsSync(templatePath)) {
    // ── Exportação via template DOCX com docxtemplater ──
    const malhasResolvidas = resolverMalhas(malhaKey);
    const fileContent = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(fileContent);

    let docXml = zip.files['word/document.xml'].asText();

    // Parágrafos do corpo (limpos)
    const paragrafos = conteudo
      .split(/\n+/)
      .map(p => p.replace(/\s{2,}/g, ' ').trim())
      .filter(Boolean);

    // Estilo do corpo: extrai pPr/rPr do parágrafo modelo {conteudo} (com fallback)
    const corpoParaRe = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{conteudo\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/;
    const corpoModelo = docXml.match(corpoParaRe);
    let pPrNormal = '<w:pPr><w:pStyle w:val="Ttulo"/><w:spacing w:before="120" w:after="240"/><w:ind w:right="125" w:firstLine="1304"/><w:jc w:val="both"/><w:rPr><w:b w:val="0"/><w:bCs w:val="0"/></w:rPr></w:pPr>';
    let rPrNormal = '<w:rPr><w:b w:val="0"/><w:bCs w:val="0"/></w:rPr>';
    if (corpoModelo) {
      const pm = corpoModelo[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
      if (pm) pPrNormal = pm[0];
      const rm = corpoModelo[0].match(/<w:r\b[^>]*>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)/);
      if (rm) rPrNormal = rm[1];
    }
    const rPrBold = '<w:rPr><w:b/><w:bCs/></w:rPr>';
    // pPr de título: sem recuo de 1ª linha, alinhado à esquerda, marca em negrito
    const pPrTitulo = pPrNormal
      .replace(/\s*w:firstLine="\d+"/, '')
      .replace(/\s*w:hanging="\d+"/, '')
      .replace(/<w:jc\s+w:val="[^"]*"\s*\/>/, '<w:jc w:val="left"/>')
      .replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, rPrBold);

    // #3 títulos sem recuo/negrito, #4 nome da empresa em negrito no corpo
    const nomesEmpresa = malhasResolvidas.map(m => m.nome).filter(Boolean);
    const corpoXml = paragrafos.map((texto) => {
      if (ehTituloParagrafo(texto)) {
        return `<w:p>${pPrTitulo}<w:r>${rPrBold}<w:t xml:space="preserve">${escXml(texto)}</w:t></w:r></w:p>`;
      }
      return `<w:p>${pPrNormal}${runsCorpo(texto, rPrNormal, rPrBold, nomesEmpresa)}</w:p>`;
    }).join('');

    // Substitui o parágrafo {conteudo} por um placeholder de XML bruto ({@corpoXml})
    docXml = docXml.replace(corpoParaRe, '<w:p><w:r><w:t xml:space="preserve">{@corpoXml}</w:t></w:r></w:p>');

    docXml = docXml.replace(
      /(<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{processo\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>)/,
      (match) => {
        const open  = '<w:p><w:r><w:t xml:space="preserve">{#processoItems}</w:t></w:r></w:p>';
        const close = '<w:p><w:r><w:t xml:space="preserve">{/processoItems}</w:t></w:r></w:p>';
        return open + match + close;
      }
    );

    docXml = docXml.replace(
      /(<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{referencia\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>)/,
      (match) => {
        const open  = '<w:p><w:r><w:t xml:space="preserve">{#referenciaItems}</w:t></w:r></w:p>';
        const close = '<w:p><w:r><w:t xml:space="preserve">{/referenciaItems}</w:t></w:r></w:p>';
        return open + match + close;
      }
    );

    // #2 assinatura: uma malha por linha (loop de parágrafo sobre {regulada})
    docXml = docXml.replace(
      /(<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?\{regulada\}(?:(?!<\/w:p>)[\s\S])*?<\/w:p>)/,
      (match) => {
        const open  = '<w:p><w:r><w:t xml:space="preserve">{#reguladas}</w:t></w:r></w:p>';
        const close = '<w:p><w:r><w:t xml:space="preserve">{/reguladas}</w:t></w:r></w:p>';
        return open + match.replace('{regulada}', '{.}') + close;
      }
    );

    zip.file('word/document.xml', docXml);

    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: false });

    const saudacao = inferirSaudacao(signatarioAntt, cargoAntt);

    doc.render({
      numero_oficio: numeroOficio,
      data: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      destinatario: signatarioAntt,
      cargo: cargoAntt,
      saudacao,
      processoItems:   processo  ? [{ processo  }] : [],
      referenciaItems: referencia ? [{ referencia }] : [],
      assunto,
      corpoXml,
      reguladas: nomesEmpresa,
    });

    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    return { buffer, nomeArquivo: gerarNomeArquivo(numeroOficio, assunto, malhaKey) };
  }

  // ── Fallback: geração programática (sem arquivo de template) ──
  const malhasResolvidas = resolverMalhas(malhaKey);
  const textoMalhas = gerarTextoMalhas(malhasResolvidas);
  const style = template.docxStyle;
  const paragrafos = conteudo.split('\n').map(
    (linha) => new Paragraph({
      children: [new TextRun({ text: linha, font: style.fonte, size: style.tamanho })],
      spacing: { after: style.espacamentoDepois, line: style.espacamentoLinha, lineRule: 'auto' },
    })
  );

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1080, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({
          text: 'RUMO LOGÍSTICA OPERADORA MULTIMODAL S.A.',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }),
        ...paragrafos,
        new Paragraph({ children: [new TextRun({ text: '', break: 2 })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Atenciosamente,', font: style.fonte, size: style.tamanho })],
        }),
        new Paragraph({ children: [new TextRun({ text: '', break: 2 })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: textoMalhas?.nomesResumidos || 'RUMO S.A.', bold: true, font: style.fonte, size: style.tamanho })],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer, nomeArquivo: gerarNomeArquivo(numeroOficio, assunto, malhaKey) };
}

async function exportarDocx(req, res, next) {
  try {
    const session = getSession(req.sessionId);
    const { ultimaMinuta } = session;

    const { conteudo } = resolverConteudo(req, ultimaMinuta);
    const numeroOficio = req.body?.numero_oficio?.trim() || '';

    const meta = req.body?.meta || {};
    const signatarioAntt = meta.signatarioAntt ?? ultimaMinuta.signatarioAntt ?? '';
    const cargoAntt      = meta.cargoAntt      ?? ultimaMinuta.cargoAntt      ?? '';
    const malhaKey       = meta.malha          ?? ultimaMinuta.malha          ?? '';
    const assunto        = meta.assunto        ?? ultimaMinuta.assunto        ?? '';
    const processo       = meta.processo       ?? ultimaMinuta.processo       ?? '';
    const referencia     = meta.referencia     ?? ultimaMinuta.referencia     ?? '';
    const modeloId       = meta.modeloId       ?? ultimaMinuta.modeloId       ?? 'objetiva';
    const responsavel      = meta.responsavel      ?? '';
    const responsavelEmail = meta.responsavelEmail ?? '';
    const area             = meta.area             ?? '';
    // Ofício e Assuntos para o histórico/SharePoint vêm explícitos do frontend:
    // resposta → nº do ofício + "Resposta Ofício"; espontânea → em branco.
    // Fallback (clientes antigos): comportamento anterior.
    const oficioSp   = meta.oficio   !== undefined ? meta.oficio   : (referencia || numeroOficio);
    const assuntosSp = meta.assuntos !== undefined ? meta.assuntos : undefined;

    if (!conteudo) {
      return res.status(400).json({ success: false, message: 'Nenhuma minuta disponível. Gere a minuta primeiro.' });
    }

    const { buffer, nomeArquivo } = await gerarDocxBuffer({
      conteudo, numeroOficio, signatarioAntt, cargoAntt,
      malhaKey, assunto, processo, referencia, modeloId,
    });

    // Salva no histórico compartilhado — fire-and-forget, não bloqueia o download
    salvarHistorico({
      titulo: gerarTituloCarta(numeroOficio),
      nomeArquivo,
      responsavel,
      responsavelEmail,
      area,
      tema: assunto,
      orgao: meta.orgao || 'ANTT',
      malha: siglaMalhaDe(malhaKey),
      oficio: oficioSp,
      assuntos: assuntosSp,
      processo,
      modeloId,
      minuta: conteudo,
      signatarioAntt,
      cargoAntt,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/**
 * Gera o DOCX (buffer + nome) a partir de uma linha do histórico.
 * Reutilizado pelo download do histórico e pela integração com o SharePoint.
 */
async function gerarDocxDeEntrada(e) {
  const siglas = (e.malha || '').split(',').map(s => s.trim()).filter(Boolean);
  const malhaKey = Object.entries(MALHAS)
    .filter(([, m]) => siglas.includes(m.sigla))
    .map(([key]) => key)
    .join(',') || e.malha;

  const { buffer, nomeArquivo } = await gerarDocxBuffer({
    conteudo: e.minuta,
    numeroOficio: (e.titulo || '').replace(/\/.*/, ''),
    signatarioAntt: e.signatario_antt,
    cargoAntt: e.cargo_antt,
    malhaKey,
    assunto: e.tema,
    processo: e.processo,
    referencia: e.oficio,
    modeloId: e.modelo_id || 'objetiva',
  });
  return { buffer, nomeArquivo: e.nome_arquivo || nomeArquivo };
}

/**
 * GET /api/historico/:id/docx — re-gera o DOCX a partir de uma entrada salva.
 */
async function exportarHistoricoDocx(req, res, next) {
  try {
    const { isEnabled, query } = require('../services/db');
    if (!isEnabled()) return res.status(503).json({ success: false, message: 'Banco de dados não configurado.' });

    const { rows } = await query(`SELECT * FROM historico WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Entrada não encontrada.' });

    const { buffer, nomeArquivo } = await gerarDocxDeEntrada(rows[0]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

module.exports = { exportarDocx, exportarHistoricoDocx, gerarDocxDeEntrada };
