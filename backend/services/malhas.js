/**
 * services/malhas.js
 * Dados cadastrais das entidades do grupo Rumo que respondem a ofícios da ANTT.
 */

const MALHAS = {
  rumo: {
    nome:  'RUMO S.A.',
    sigla: 'RUMO',
    cnpj:  '02.387.241/0001-60',
  },
  norte: {
    nome:  'RUMO MALHA NORTE S.A.',
    sigla: 'RMN',
    cnpj:  '24.962.466/0001-36',
  },
  paulista: {
    nome:  'RUMO MALHA PAULISTA S.A.',
    sigla: 'RMP',
    cnpj:  '02.502.844/0001-66',
  },
  oeste: {
    nome:  'RUMO MALHA OESTE S.A.',
    sigla: 'RMO',
    cnpj:  '39.115.514/0001-28',
  },
  sul: {
    nome:  'RUMO MALHA SUL S.A.',
    sigla: 'RMS',
    cnpj:  '01.258.944/0001-26',
  },
  central: {
    nome:  'RUMO MALHA CENTRAL S.A.',
    sigla: 'RMC',
    cnpj:  '33.572.408/0001-97',
  },
};

/**
 * Retorna os dados da malha identificada ou um placeholder caso não identificada.
 * @param {string} chave - Chave retornada pelo Claude (ex: 'norte', 'sul', 'não identificada')
 * @returns {{ nome: string, sigla: string, cnpj: string }}
 */
function resolverMalha(chave) {
  if (!chave) return null;
  const key = chave.toLowerCase().trim();
  return MALHAS[key] || null;
}

module.exports = { MALHAS, resolverMalha };
