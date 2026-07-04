/**
 * services/anttService.js
 * Base de referência dos servidores da ANTT (superintendências ferroviárias/
 * regulatórias) usada para autocomplete de destinatário. Dado que muda devagar,
 * mantido num único JSON versionado — atualizar = editar o arquivo e redeploy.
 */

const fs = require('fs');
const path = require('path');

let cache = null;

function carregar() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'antt-servidores.json'), 'utf-8');
    cache = JSON.parse(raw);
  } catch (err) {
    console.error('[ANTT] Falha ao carregar base de servidores:', err.message);
    cache = { superintendencias: [], servidores: [] };
  }
  return cache;
}

module.exports = { carregar };
