/**
 * services/claudeService.js
 * Camada de integração com a API da Claude (Anthropic)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const { resolverMalha } = require('./malhas');

/**
 * Faz uma chamada à API Claude com retry automático em caso de sobrecarga.
 * @param {Array} messages - Array de mensagens no formato Anthropic
 * @param {string} systemPrompt - Prompt de sistema
 * @param {number} maxTokens
 * @returns {Promise<string>} - Texto da resposta
 */
async function callClaude(messages, systemPrompt, maxTokens = 3000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY não configurada. Adicione a variável de ambiente no Render ou no arquivo .env'
    );
  }

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  };

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Claude API retornou status ${response.status}: ${errorData?.error?.message || 'Erro desconhecido'}`
        );
      }

      const data = await response.json();
      const textBlock = data.content?.find((b) => b.type === 'text');

      if (!textBlock) {
        throw new Error('Resposta da Claude sem bloco de texto');
      }

      return textBlock.text;
    } catch (err) {
      lastError = err;
      // Retry apenas em erros 529 (sobrecarga) ou 503
      if (err.message.includes('529') || err.message.includes('503')) {
        console.warn(`[Claude] Tentativa ${attempt} falhou (sobrecarga). Aguardando...`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err; // Erros definitivos não fazem retry
    }
  }

  throw lastError;
}

/**
 * Analisa o texto bruto de um ofício da ANTT e retorna um briefing estruturado em JSON.
 * @param {string} textoOficio - Texto extraído do PDF
 * @returns {Promise<Object>} - Briefing estruturado
 */
async function extrairBriefingOficio(textoOficio) {
  const systemPrompt = `Você é um especialista em análise de documentos regulatórios do setor ferroviário brasileiro.
Sua tarefa é extrair informações estruturadas de ofícios da ANTT (Agência Nacional de Transportes Terrestres).
Responda APENAS com JSON válido, sem nenhum texto antes ou depois, sem blocos de código markdown.`;

  const userMessage = `Analise o seguinte texto de um ofício da ANTT e extraia as informações abaixo em formato JSON.

TEXTO DO OFÍCIO:
"""
${textoOficio.substring(0, 6000)}
"""

Retorne EXATAMENTE neste formato JSON (sem markdown, apenas o JSON puro):
{
  "numero": "número/referência do ofício (ex: OF.ANTT.123/2025) ou 'Não identificado'",
  "data": "data do ofício (ex: 15/04/2025) ou 'Não identificada'",
  "signatarioAntt": "nome e cargo do signatário da ANTT ou 'Não identificado'",
  "area": "superintendência ou área da ANTT (ex: SUFER, GEROP) ou 'Não identificada'",
  "prazo": "prazo de resposta mencionado ou 'Não especificado'",
  "natureza": "tipo da solicitação (ex: Requerimento de Informações, Solicitação de Documentos) ou 'Não identificada'",
  "fundamentoLegal": "normas, resoluções ou contratos citados ou 'Não citado'",
  "malha": "qual entidade do grupo Rumo é destinatária ou mencionada no ofício — responda EXATAMENTE com uma das opções: rumo | norte | paulista | oeste | sul | central | não identificada",
  "pontos": [
    "ponto 1 a ser respondido",
    "ponto 2 a ser respondido"
  ],
  "documentosRequisitados": [
    "documento 1 solicitado"
  ]
}

Para o campo 'malha': procure no texto referências a contratos de concessão, trechos ferroviários, estados atendidos ou razão social. Use 'rumo' para RUMO S.A. (holding), 'norte' para Malha Norte, 'paulista' para Malha Paulista, 'oeste' para Malha Oeste, 'sul' para Malha Sul, 'central' para Malha Central.
Se não houver pontos claros, crie pelo menos 1 ponto resumindo a solicitação principal.`;

  const rawResponse = await callClaude(
    [{ role: 'user', content: userMessage }],
    systemPrompt,
    1500
  );

  // Limpar possíveis resíduos de markdown
  const cleaned = rawResponse.replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.error('[Claude] Falha ao parsear JSON do briefing:', cleaned.substring(0, 300));
    // Retorna um briefing de fallback para não travar o frontend
    return {
      numero: 'Não identificado',
      data: 'Não identificada',
      signatarioAntt: 'Não identificado',
      area: 'Não identificada',
      prazo: 'Não especificado',
      natureza: 'Requerimento de Informação',
      fundamentoLegal: 'Não citado',
      malha: 'não identificada',
      pontos: ['Não foi possível extrair os pontos automaticamente. Por favor, revise o PDF.'],
      documentosRequisitados: [],
    };
  }
}

/**
 * Gera uma minuta de resposta ao ofício com base no briefing e nas informações fornecidas pelo usuário.
 * @param {Object} params
 * @param {Object} params.briefing - Briefing extraído do ofício
 * @param {string} params.signatario - Nome do signatário da Rumo
 * @param {string} params.cargo - Cargo do signatário
 * @param {Array}  params.pontosRespondidos - Array de {ponto, resposta}
 * @param {string} params.textoModelosReferencia - Texto concatenado dos modelos de referência
 * @returns {Promise<string>} - Texto da minuta gerada
 */
async function gerarMinuta({ briefing, signatario, cargo, pontosRespondidos, textoModelosReferencia }) {
  // Resolve os dados cadastrais da malha identificada
  const malha = resolverMalha(briefing?.malha);
  const malhaIdentificada = malha
    ? `${malha.nome} ("${malha.sigla}"), inscrita no CNPJ/MF sob nº ${malha.cnpj}`
    : '[ENTIDADE NÃO IDENTIFICADA — verificar manualmente]';

  const aberturaObrigatoria = malha
    ? `A ${malha.nome} ("${malha.sigla}"), inscrita no CNPJ/MF sob nº ${malha.cnpj}, concessionária prestadora do serviço público de transporte ferroviário de cargas,`
    : 'A [ENTIDADE DO GRUPO RUMO], concessionária prestadora do serviço público de transporte ferroviário de cargas,';

  const systemPrompt = `Você é o Assistente Regulatório do grupo Rumo, especializado em redigir respostas institucionais a ofícios da ANTT. Você produz minutas formais de alta qualidade, prontas para aprovação e assinatura.

PADRÕES OBRIGATÓRIOS:
- Tom: formal técnico-jurídico, nunca coloquial
- Tratamento: "Vossa Senhoria" para diretores/superintendentes
- Verbos na terceira pessoa do singular
- Linguagem: terminologia do setor ferroviário e regulatório
- Estrutura: cabeçalho de referência → abertura protocolar → atendimento aos pontos → encerramento formal

ENTIDADE RESPONDENTE: ${malhaIdentificada}

${textoModelosReferencia ? `MODELOS DE REFERÊNCIA (use o estilo e vocabulário destes documentos):
${textoModelosReferencia.substring(0, 8000)}` : ''}`;

  const pontosFormatados = pontosRespondidos
    ?.map((item, i) => `${i + 1}. PONTO: ${item.ponto}\n   RESPOSTA DO USUÁRIO: ${item.resposta || '(não informado)'}`)
    .join('\n\n') || 'Nenhum ponto respondido fornecido.';

  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const userMessage = `Redija uma minuta completa de resposta ao seguinte ofício da ANTT.

═══════════ DADOS DO OFÍCIO ═══════════
Número: ${briefing?.numero || 'Não identificado'}
Data: ${briefing?.data || 'Não identificada'}
Signatário ANTT: ${briefing?.signatarioAntt || 'Não identificado'}
Área: ${briefing?.area || 'Não identificada'}
Prazo: ${briefing?.prazo || 'Não especificado'}
Natureza: ${briefing?.natureza || 'Requerimento de Informação'}
Fundamento Legal: ${briefing?.fundamentoLegal || 'Não citado'}

═══════════ ENTIDADE RESPONDENTE ═══════════
${malhaIdentificada}

═══════════ PONTOS A RESPONDER ═══════════
${pontosFormatados}

═══════════ SIGNATÁRIO ═══════════
Nome: ${signatario || '[NOME DO SIGNATÁRIO]'}
Cargo: ${cargo || '[CARGO]'}

Data de emissão: São Paulo, ${dataHoje}

INSTRUÇÕES:
1. O PRIMEIRO PARÁGRAFO DO CORPO deve começar OBRIGATORIAMENTE com:
   "${aberturaObrigatoria} vem, respeitosamente, à presença de Vossa Senhoria, em atenção ao ${briefing?.numero || 'Ofício'}, para..."
2. Use a estrutura: referência ao ofício → abertura com identificação da empresa → atendimento numerado a cada ponto → encerramento → assinatura
3. Para pontos sem resposta informada, escreva "[AGUARDANDO INFORMAÇÃO INTERNA]"
4. Inclua expressões protocolares como "A Rumo permanece à disposição..."
5. Numere o ofício como OF.RUMO.DIR.REG.XXX/${new Date().getFullYear()}
6. Gere APENAS o texto da minuta, sem comentários ou explicações adicionais`;

  return callClaude(
    [{ role: 'user', content: userMessage }],
    systemPrompt,
    3000
  );
}

module.exports = { callClaude, extrairBriefingOficio, gerarMinuta };
