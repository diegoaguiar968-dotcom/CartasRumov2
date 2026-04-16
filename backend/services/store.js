/**
 * services/store.js
 * Armazenamento em memória para modelos e ofícios processados.
 *
 * NOTA: Este store é volátil — os dados são perdidos ao reiniciar o servidor.
 * Para persistência, substitua por um banco de dados (PostgreSQL, MongoDB, etc.)
 */

const modelos = [];   // PDFs/DOCXs enviados pelo usuário (limite: 5)
const oficios = [];   // Ofícios da ANTT processados
const modelosPermanentes = []; // DOCXs fixos de backend/templates/ (carregados na inicialização)

// Última minuta gerada — usada pelos endpoints GET de export
const ultimaMinuta = { texto: '', signatario: '', cargo: '' };

module.exports = { modelos, oficios, modelosPermanentes, ultimaMinuta };
