/**
 * services/fileTextService.js
 * Extração de texto "best-effort" de documentos complementares em vários
 * formatos. O objetivo não é reproduzir o arquivo fielmente, e sim dar à IA
 * o CONTEXTO do que acompanha o ofício (nota técnica, planilha, anexos...).
 *
 * Formatos com leitura de conteúdo: PDF, DOCX, XLSX, ZIP (recursivo), texto
 * puro (txt/csv/md/json/xml/html).
 * Demais formatos (imagens, .doc antigo, .msg, ...) são registrados apenas
 * pelo nome — a IA sabe que o documento existe, mas não lê seu conteúdo.
 */

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const mammoth = require('mammoth');
const { extrairTextoPDF } = require('./pdfService');

// Limite de texto guardado por documento (o prompt tem orçamento finito)
const LIMITE_TEXTO = 8000;
// Dentro de um .zip, lê no máximo estes arquivos para não estourar memória
const MAX_ARQUIVOS_ZIP = 10;

const EXTENSOES_TEXTO = ['.txt', '.csv', '.md', '.json', '.xml', '.html', '.htm', '.log'];

function limpar(texto) {
  return String(texto || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** DOCX → texto (mammoth lê o corpo do documento) */
async function extrairDocx(filePath) {
  const { value } = await mammoth.extractRawText({ path: filePath });
  return value;
}

/**
 * XLSX → texto. Lê sharedStrings + as células de cada planilha via PizZip,
 * sem depender de uma biblioteca de planilha completa.
 */
function extrairXlsx(buffer) {
  const zip = new PizZip(buffer);

  // Tabela de strings compartilhadas: <si>...<t>texto</t>...</si>
  const compartilhadas = [];
  const sharedFile = zip.file('xl/sharedStrings.xml');
  if (sharedFile) {
    const sharedXml = sharedFile.asText();
    for (const si of sharedXml.match(/<si>[\s\S]*?<\/si>/g) || []) {
      const partes = (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
        .map(t => t.replace(/<[^>]+>/g, ''));
      compartilhadas.push(decodeXml(partes.join('')));
    }
  }

  const planilhas = Object.keys(zip.files)
    .filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort();

  const linhasTexto = [];
  for (const nome of planilhas) {
    const xml = zip.file(nome).asText();
    for (const linha of xml.match(/<row[\s\S]*?<\/row>/g) || []) {
      const celulas = [];
      for (const c of linha.match(/<c\b[^>]*(?:\/>|[\s\S]*?<\/c>)/g) || []) {
        const ehCompartilhada = /t="s"/.test(c);
        const valor = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        const inline = (c.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
        if (inline !== undefined) {
          celulas.push(decodeXml(inline));
        } else if (valor !== undefined) {
          celulas.push(ehCompartilhada ? (compartilhadas[Number(valor)] ?? '') : valor);
        }
      }
      const texto = celulas.filter(v => String(v).trim()).join(' | ');
      if (texto) linhasTexto.push(texto);
      if (linhasTexto.join('\n').length > LIMITE_TEXTO) break;
    }
    if (linhasTexto.join('\n').length > LIMITE_TEXTO) break;
  }

  return linhasTexto.join('\n');
}

function decodeXml(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** ZIP → concatena o texto dos arquivos internos que sabemos ler. */
async function extrairZip(filePath) {
  const zip = new PizZip(fs.readFileSync(filePath));
  const internos = Object.keys(zip.files)
    .filter(n => !zip.files[n].dir && !n.startsWith('__MACOSX/'))
    .sort();

  const partes = [];
  const listaCompleta = internos.map(n => `- ${n}`).join('\n');
  partes.push(`Conteúdo do arquivo compactado (${internos.length} arquivo(s)):\n${listaCompleta}`);

  let lidos = 0;
  for (const nome of internos) {
    if (lidos >= MAX_ARQUIVOS_ZIP) break;
    if (partes.join('\n').length > LIMITE_TEXTO) break;

    const ext = path.extname(nome).toLowerCase();
    try {
      let texto = '';
      if (ext === '.docx') {
        const { value } = await mammoth.extractRawText({ buffer: zip.file(nome).asNodeBuffer() });
        texto = value;
      } else if (ext === '.xlsx') {
        texto = extrairXlsx(zip.file(nome).asNodeBuffer());
      } else if (EXTENSOES_TEXTO.includes(ext)) {
        texto = zip.file(nome).asText();
      } else {
        continue; // PDF dentro de zip exige arquivo em disco — fica só listado
      }
      if (limpar(texto)) {
        partes.push(`\n--- ${nome} ---\n${limpar(texto)}`);
        lidos++;
      }
    } catch {
      // arquivo interno ilegível — segue para o próximo
    }
  }

  return partes.join('\n');
}

/**
 * Extrai o texto de um arquivo qualquer, escolhendo a estratégia pela extensão.
 * Nunca lança: em caso de falha devolve `extraido: false` com o motivo, para
 * que o documento ainda seja registrado pelo nome.
 *
 * @param {string} filePath      caminho em disco
 * @param {string} nomeOriginal  nome original enviado pelo usuário
 * @returns {Promise<{texto: string, extraido: boolean, formato: string, motivo?: string}>}
 */
async function extrairTextoArquivo(filePath, nomeOriginal) {
  const ext = path.extname(nomeOriginal || filePath).toLowerCase();
  const formato = ext.replace('.', '') || 'desconhecido';

  try {
    let texto = '';

    if (ext === '.pdf') {
      texto = await extrairTextoPDF(filePath);
    } else if (ext === '.docx') {
      texto = await extrairDocx(filePath);
    } else if (ext === '.xlsx' || ext === '.xlsm') {
      texto = extrairXlsx(fs.readFileSync(filePath));
    } else if (ext === '.zip') {
      texto = await extrairZip(filePath);
    } else if (EXTENSOES_TEXTO.includes(ext)) {
      texto = fs.readFileSync(filePath, 'utf-8');
    } else {
      return {
        texto: '',
        extraido: false,
        formato,
        motivo: `Formato ${formato || 'desconhecido'} não permite leitura automática do conteúdo.`,
      };
    }

    const limpo = limpar(texto);
    if (!limpo) {
      return {
        texto: '',
        extraido: false,
        formato,
        motivo: 'Não foi possível extrair texto (arquivo vazio, escaneado ou protegido).',
      };
    }

    return { texto: limpo.substring(0, LIMITE_TEXTO), extraido: true, formato };
  } catch (err) {
    console.error(`[Arquivo] Falha ao extrair "${nomeOriginal}": ${err.message}`);
    return {
      texto: '',
      extraido: false,
      formato,
      motivo: `Falha na leitura do arquivo (${err.message}).`,
    };
  }
}

module.exports = { extrairTextoArquivo, LIMITE_TEXTO };
