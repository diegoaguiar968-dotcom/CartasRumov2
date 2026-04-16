/**
 * services/store.js
 * Armazenamento em memória para modelos e ofícios processados.
 * 
 * NOTA: Este store é volátil — os dados são perdidos ao reiniciar o servidor.
 * Para persistência, substitua por um banco de dados (PostgreSQL, MongoDB, etc.)
 */

const modelos = [];   // PDFs de cartas-modelo carregados pelo usuário
const oficios = [];   // Ofícios da ANTT processados

module.exports = { modelos, oficios };
