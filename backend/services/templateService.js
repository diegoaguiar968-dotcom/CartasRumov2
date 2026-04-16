/**
 * services/templateService.js
 * Carrega os modelos DOCX fixos da pasta backend/templates/ na inicialização do servidor.
 * Esses modelos são permanentes e não contam no limite de uploads do usuário.
 */

const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * Extrai o texto de um arquivo DOCX usando mammoth.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function extrairTextoDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

/**
 * Lê todos os arquivos .docx da pasta templates/ e retorna um array de modelos permanentes.
 * @returns {Promise<Array>}
 */
async function carregarTemplatesFixos() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.warn('[Templates] Pasta templates/ não encontrada. Nenhum modelo fixo carregado.');
    return [];
  }

  const arquivos = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.docx'));

  if (arquivos.length === 0) {
    console.warn('[Templates] Nenhum arquivo .docx encontrado em templates/.');
    return [];
  }

  const modelos = [];
  for (const arquivo of arquivos) {
    const filePath = path.join(TEMPLATES_DIR, arquivo);
    try {
      const texto = await extrairTextoDocx(filePath);
      const stat = fs.statSync(filePath);
      modelos.push({
        id: `template-${arquivo}`,
        nome: arquivo,
        tamanho: stat.size,
        textoExtraido: texto,
        preview: texto.substring(0, 200).replace(/\s+/g, ' ').trim() + '...',
        dataUpload: stat.mtime.toISOString(),
        isPermanente: true,
      });
      console.log(`[Templates] Carregado: ${arquivo} (${Math.round(stat.size / 1024)} KB)`);
    } catch (err) {
      console.error(`[Templates] Erro ao carregar ${arquivo}:`, err.message);
    }
  }

  return modelos;
}

module.exports = { carregarTemplatesFixos };
