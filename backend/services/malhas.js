/**
 * services/malhas.js
 * Dados cadastrais das entidades do grupo Rumo que respondem a ofícios da ANTT.
 */

const MALHAS = {
  rumo: {
    nome:  'RUMO S.A.',
    sigla: 'RSA',
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
 * Resolve uma única malha pela chave.
 * @param {string} chave
 * @returns {{ nome, sigla, cnpj } | null}
 */
function resolverMalha(chave) {
  if (!chave) return null;
  const key = chave.toLowerCase().trim();
  return MALHAS[key] || null;
}

/**
 * Resolve uma ou mais malhas. Aceita string única, string com vírgulas ou array.
 * @param {string|string[]} chaves
 * @returns {Array<{ nome, sigla, cnpj }>}
 */
function resolverMalhas(chaves) {
  if (!chaves) return [];
  const lista = Array.isArray(chaves)
    ? chaves
    : String(chaves).split(',').map(s => s.trim());
  return lista.map(c => resolverMalha(c)).filter(Boolean);
}

/**
 * Gera os blocos de texto padrão ANTT para uma ou múltiplas entidades.
 *
 * Single:
 *   identificacao → 'RUMO MALHA PAULISTA S.A. ("RMP"), inscrita no CNPJ/MF sob o nº ...'
 *   abertura      → 'A RUMO MALHA PAULISTA S.A. ... concessionária ..., vem, ...'
 *
 * Múltiplas:
 *   identificacao → 'RUMO S.A. ("RUMO"), inscrita...; RUMO MALHA NORTE S.A. ("RMN"), inscrita...; e RUMO MALHA CENTRAL S.A. ...'
 *   abertura      → '[identificacao], concessionárias ..., vêm, ...'
 *
 * @param {Array<{ nome, sigla, cnpj }>} malhas
 * @returns {{ identificacao, abertura, plural } | null}
 */
function gerarTextoMalhas(malhas) {
  if (!malhas || malhas.length === 0) return null;

  if (malhas.length === 1) {
    const m = malhas[0];
    const id = `${m.nome} ("${m.sigla}"), inscrita no CNPJ/MF sob o nº ${m.cnpj}`;
    return {
      identificacao: id,
      abertura: `A ${id}, concessionária prestadora do serviço público de transporte ferroviário de cargas,`,
      nomesResumidos: m.nome,
      plural: false,
    };
  }

  // Múltiplas — lista com ponto-e-vírgula, "e" antes da última
  const partes = malhas.map((m, i) => {
    const prefixo = i === malhas.length - 1 ? 'e ' : '';
    return `${prefixo}${m.nome} ("${m.sigla}"), inscrita no CNPJ sob o nº ${m.cnpj}`;
  });
  const id = partes.join('; ');
  return {
    identificacao: id,
    abertura: `${id}, concessionárias prestadoras do serviço público de transporte ferroviário de cargas,`,
    nomesResumidos: malhas.map(m => m.nome).join(', '),
    plural: true,
  };
}

module.exports = { MALHAS, resolverMalha, resolverMalhas, gerarTextoMalhas };

