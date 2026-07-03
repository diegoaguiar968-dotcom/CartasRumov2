/**
 * services/claudeService.js
 * Camada de integração com a API da Claude (Anthropic)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const { resolverMalhas, gerarTextoMalhas } = require('./malhas');

/**
 * Faz uma chamada à API Claude com retry automático em caso de sobrecarga.
 * @param {Array} messages - Array de mensagens no formato Anthropic
 * @param {string} systemPrompt - Prompt de sistema
 * @param {number} maxTokens
 * @returns {Promise<string>} - Texto da resposta
 */
async function callClaude(messages, systemPrompt, maxTokens = 8000) {
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
  "numero": "número/identificação do próprio ofício (ex: OFÍCIO SEI Nº 13884/2026/SUSPI/DIR-ANTT, OF.ANTT.123/2025) ou 'Não identificado'",
  "processo": "número do processo administrativo/SEI — formato NNNNN.NNNNNN/AAAA-NN (ex: 50505.018666/2026-59). Procure por 'Processo nº', 'SEI nº', 'Processo SEI'. Se não encontrar, retorne 'Não identificado'",
  "data": "data do ofício (ex: 15/04/2025) ou 'Não identificada'",
  "signatarioAntt": "nome e cargo do signatário da ANTT ou 'Não identificado'",
  "area": "superintendência ou área da ANTT (ex: SUFER, GEROP) ou 'Não identificada'",
  "prazo": "prazo de resposta mencionado ou 'Não especificado'",
  "natureza": "tipo da solicitação (ex: Requerimento de Informações, Solicitação de Documentos) ou 'Não identificada'",
  "fundamentoLegal": "normas, resoluções ou contratos citados ou 'Não citado'",
  "malha": "quais entidades do grupo Rumo são destinatárias ou mencionadas no ofício — responda com uma ou mais chaves separadas por vírgula: rumo | norte | paulista | oeste | sul | central. Ex.: 'paulista,norte' para múltiplas. Use 'não identificada' se nenhuma for identificada.",
  "assunto": "assunto conciso (máx 80 chars) no formato: [Tipo de Ação] - [Programa/Referência] - [Entidade(s)]. Exemplos: 'Dilação de Prazo - COE - RMP', 'Envio de Documentos - PSI - RMP', 'Informações sobre Acidente km 123'. Sem ponto final.",
  "pontos": [
    "ponto 1 a ser respondido",
    "ponto 2 a ser respondido"
  ],
  "documentosRequisitados": [
    "documento 1 solicitado"
  ]
}

ATENÇÃO — distinção obrigatória entre 'numero' e 'processo':
- 'numero': é a identificação do próprio ofício (ex: "OFÍCIO SEI Nº 13884/2026/SUSPI/DIR-ANTT")
- 'processo': é o número do processo administrativo/SEI vinculado (ex: "50505.018666/2026-59"), que segue o padrão NNNNN.NNNNNN/AAAA-NN. São sempre valores distintos.

Para o campo 'malha': procure referências a contratos de concessão, trechos ferroviários, estados atendidos ou razão social. Pode haver múltiplas entidades — separe por vírgula (ex: 'paulista,norte'). Chaves: 'rumo' (RUMO S.A. holding), 'norte', 'paulista', 'oeste', 'sul', 'central'.
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
      processo: 'Não identificado',
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
 * Extrai briefing de ofício enviando o PDF diretamente ao Claude (leitura nativa).
 * Usado como fallback quando pdf-parse retorna texto ilegível (PDFs do SEI/governo
 * com codificação de fonte customizada ou documentos escaneados).
 * @param {string} pdfPath - Caminho absoluto do arquivo PDF
 * @returns {Promise<Object>} - Briefing estruturado
 */
async function extrairBriefingOficioPDF(pdfPath) {
  const fs = require('fs');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada.');

  const pdfBase64 = fs.readFileSync(pdfPath).toString('base64');

  const systemPrompt = `Você é um especialista em análise de documentos regulatórios do setor ferroviário brasileiro.
Sua tarefa é extrair informações estruturadas de ofícios da ANTT (Agência Nacional de Transportes Terrestres).
Responda APENAS com JSON válido, sem nenhum texto antes ou depois, sem blocos de código markdown.`;

  const userPrompt = `Analise o ofício da ANTT no documento acima e extraia as informações abaixo em formato JSON.

Retorne EXATAMENTE neste formato JSON (sem markdown, apenas o JSON puro):
{
  "numero": "número/identificação do próprio ofício (ex: OFÍCIO SEI Nº 13884/2026/SUSPI/DIR-ANTT) ou 'Não identificado'",
  "processo": "número do processo administrativo/SEI — formato NNNNN.NNNNNN/AAAA-NN. Procure por 'Processo nº', 'SEI nº'. Se não encontrar, retorne 'Não identificado'",
  "data": "data do ofício (ex: 15/04/2025) ou 'Não identificada'",
  "signatarioAntt": "nome e cargo do signatário da ANTT ou 'Não identificado'",
  "area": "superintendência ou área da ANTT (ex: SUFER, GEROP) ou 'Não identificada'",
  "prazo": "prazo de resposta mencionado ou 'Não especificado'",
  "natureza": "tipo da solicitação (ex: Requerimento de Informações, Solicitação de Documentos) ou 'Não identificada'",
  "fundamentoLegal": "normas, resoluções ou contratos citados ou 'Não citado'",
  "malha": "quais entidades do grupo Rumo são destinatárias — uma ou mais chaves separadas por vírgula: rumo | norte | paulista | oeste | sul | central. Ex.: 'paulista,norte'. Use 'não identificada' se nenhuma identificada.",
  "assunto": "assunto conciso (máx 80 chars) no formato: [Tipo de Ação] - [Programa/Referência] - [Entidade(s)]. Exemplos: 'Dilação de Prazo - COE - RMP', 'Envio de Documentos - PSI - RMP', 'Informações sobre Acidente km 123'. Sem ponto final.",
  "pontos": ["ponto 1 a ser respondido", "ponto 2 a ser respondido"],
  "documentosRequisitados": ["documento 1 solicitado"]
}

Para 'malha': procure referências a contratos de concessão, trechos ferroviários ou razão social. Se não houver pontos claros, crie pelo menos 1 ponto resumindo a solicitação principal.`;

  const body = {
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
        },
        { type: 'text', text: userPrompt },
      ],
    }],
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
          'anthropic-beta': 'pdfs-2024-09-25',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Claude API status ${response.status}: ${err?.error?.message || 'Erro'}`);
      }

      const data = await response.json();
      const textBlock = data.content?.find(b => b.type === 'text');
      if (!textBlock) throw new Error('Resposta sem bloco de texto');

      const cleaned = textBlock.text.replace(/```json|```/gi, '').trim();
      try {
        return JSON.parse(cleaned);
      } catch {
        console.error('[Claude/PDF] Falha ao parsear JSON:', cleaned.substring(0, 200));
        return {
          numero: 'Não identificado', processo: 'Não identificado',
          data: 'Não identificada', signatarioAntt: 'Não identificado',
          area: 'Não identificada', prazo: 'Não especificado',
          natureza: 'Requerimento de Informação', fundamentoLegal: 'Não citado',
          malha: 'não identificada',
          pontos: ['Não foi possível extrair os pontos automaticamente. Por favor, revise o PDF.'],
          documentosRequisitados: [],
        };
      }
    } catch (err) {
      lastError = err;
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw lastError;
}

// ─── Bloco de feedback estruturado da IA ───
// A minuta vem seguida de um delimitador + JSON {resumo, atencao, dicas},
// que o frontend exibe num painel próprio. Delimitador é mais robusto que
// pedir a resposta inteira em JSON (textos longos quebram o parse).
const FEEDBACK_DELIM = '<<<FEEDBACK>>>';

const INSTRUCAO_FEEDBACK = `

BLOCO DE FEEDBACK (obrigatório, fora da carta):
Após o texto completo da minuta, escreva em uma linha isolada exatamente:
${FEEDBACK_DELIM}
e, na linha seguinte, um JSON de linha única no formato:
{"resumo":"o que foi feito, em 1-2 frases","atencao":["item que merece revisão humana"],"dicas":["sugestão opcional de melhoria"]}
Em "atencao", liste itens como: prazos citados, normas/fundamentação legal utilizadas, dados que você assumiu sem confirmação e lacunas marcadas como [AGUARDANDO INFORMAÇÃO INTERNA]. Máximo 4 itens por lista; listas podem ser vazias. Este bloco NÃO faz parte da carta — nunca o mencione no corpo.`;

/**
 * Separa o texto da minuta do bloco de feedback estruturado.
 * @param {string} raw - Resposta bruta da Claude
 * @returns {{ texto: string, feedback: {resumo, atencao, dicas} | null }}
 */
function separarFeedback(raw) {
  const idx = raw.indexOf(FEEDBACK_DELIM);
  if (idx === -1) return { texto: raw.trim(), feedback: null };
  const texto = raw.slice(0, idx).trim();
  const cauda = raw.slice(idx + FEEDBACK_DELIM.length).replace(/```json|```/gi, '').trim();
  try {
    const fb = JSON.parse(cauda);
    return {
      texto,
      feedback: {
        resumo: typeof fb.resumo === 'string' ? fb.resumo : '',
        atencao: Array.isArray(fb.atencao) ? fb.atencao.filter((x) => typeof x === 'string') : [],
        dicas: Array.isArray(fb.dicas) ? fb.dicas.filter((x) => typeof x === 'string') : [],
      },
    };
  } catch {
    return { texto, feedback: null };
  }
}

/**
 * Gera uma minuta de resposta ao ofício com base no briefing e nas informações fornecidas pelo usuário.
 * @param {Object} params
 * @param {Object} params.briefing - Briefing extraído do ofício
 * @param {Array}  params.pontosRespondidos - Array de {ponto, resposta}
 * @param {string} params.textoModelosReferencia - Texto concatenado dos modelos de referência
 * @returns {Promise<{texto: string, feedback: Object|null}>} - Minuta + feedback estruturado
 */
async function gerarMinuta({ briefing, pontosRespondidos, textoModelosReferencia, templateHint, usaTemplate, contextosAdicionais }) {
  // Resolve os dados cadastrais da(s) malha(s) identificada(s)
  const malhas = resolverMalhas(briefing?.malha);
  const textoMalhas = gerarTextoMalhas(malhas);
  const malhaIdentificada = textoMalhas?.identificacao || '[ENTIDADE DO GRUPO RUMO]';
  const aberturaObrigatoria = textoMalhas?.abertura
    || 'A [ENTIDADE DO GRUPO RUMO], concessionária prestadora do serviço público de transporte ferroviário de cargas,';

  const systemPrompt = `Você é o Assistente Regulatório do grupo Rumo, especializado em redigir respostas institucionais a ofícios da ANTT. Você produz minutas formais de alta qualidade, prontas para aprovação e assinatura.

PADRÕES OBRIGATÓRIOS:
- Tom: formal técnico-jurídico, nunca coloquial
- Tratamento: "Vossa Senhoria" para diretores/superintendentes
- Verbos na terceira pessoa do singular
- Linguagem: terminologia do setor ferroviário e regulatório
- Estrutura: cabeçalho de referência → abertura protocolar → atendimento aos pontos → encerramento formal
- Normas: NÃO citar normas que regulam procedimentos internos da ANTT (ex: regras de dilação de prazo no SEI, ritos processuais). Citar apenas normas diretamente relevantes ao mérito da questão respondida.
- Objetividade: Formular pedidos e informações de forma direta e concisa. Evitar parênteses explicativos longos com referências documentais. Exemplo correto: "requerer nova dilação de prazo de 30 (trinta) dias para o cumprimento da obrigação".

ENTIDADE RESPONDENTE: ${malhaIdentificada}

${textoModelosReferencia ? `MODELOS DE REFERÊNCIA (use o estilo e vocabulário destes documentos):
${textoModelosReferencia.substring(0, 8000)}` : ''}

ESTILO DO DOCUMENTO:
${templateHint || 'Tom formal padrão.'}

${usaTemplate ? `FORMATO DO OUTPUT — INSTRUÇÃO CRÍTICA:
O documento final será montado a partir de um template DOCX com cabeçalho, endereçamento, saudação e assinatura já formatados.
Gere APENAS os parágrafos do corpo da resposta — o conteúdo entre a saudação e o "Atenciosamente,".
NÃO inclua: cabeçalho da carta, número do ofício, data, destinatário, saudação ("Prezada..."), "Atenciosamente,", nome do signatário, cargo nem rodapé.
Comece diretamente com o primeiro parágrafo de resposta.` : ''}`;

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
${contextosAdicionais?.length ? `
═══════════ DOCUMENTOS COMPLEMENTARES (apenas contexto) ═══════════
Os documentos abaixo acompanham o ofício. Use-os para enriquecer o contexto e fundamentar afirmações quando relevante. NÃO responda ponto a ponto nem liste seus itens individualmente.

${contextosAdicionais.map(d => `[${d.nome}]\n${d.texto}`).join('\n\n---\n\n')}` : ''}

Data de emissão: São Paulo, ${dataHoje}

INSTRUÇÕES:
${usaTemplate ? `1. O PRIMEIRO PARÁGRAFO deve começar OBRIGATORIAMENTE com:
   "${aberturaObrigatoria} vem, respeitosamente, à presença de Vossa Senhoria, em atenção ao ${briefing?.numero || 'Ofício'}, para..."
2. Atenda cada ponto numeradamente
3. Para pontos sem resposta, escreva "[AGUARDANDO INFORMAÇÃO INTERNA]"
4. O ÚLTIMO PARÁGRAFO deve ser OBRIGATORIAMENTE: "Sendo o que nos cumpria no momento, permanecemos à disposição para quaisquer esclarecimentos ou informações adicionais."
5. NÃO adicione cabeçalho, saudação, "Atenciosamente," ou assinatura — apenas os parágrafos do corpo
6. Gere APENAS o corpo da resposta, sem comentários ou explicações adicionais (exceto o bloco de feedback ao final)` : `1. O PRIMEIRO PARÁGRAFO DO CORPO deve começar OBRIGATORIAMENTE com:
   "${aberturaObrigatoria} vem, respeitosamente, à presença de Vossa Senhoria, em atenção ao ${briefing?.numero || 'Ofício'}, para..."
2. Use a estrutura: referência ao ofício → abertura com identificação da empresa → atendimento numerado a cada ponto → encerramento → assinatura
3. Para pontos sem resposta informada, escreva "[AGUARDANDO INFORMAÇÃO INTERNA]"
4. O parágrafo antes de "Atenciosamente," deve ser OBRIGATORIAMENTE: "Sendo o que nos cumpria no momento, permanecemos à disposição para quaisquer esclarecimentos ou informações adicionais."
5. Numere o ofício como OF.RUMO.DIR.REG.XXX/${new Date().getFullYear()}
6. Gere APENAS o texto da minuta, sem comentários ou explicações adicionais (exceto o bloco de feedback ao final)`}`;

  const raw = await callClaude(
    [{ role: 'user', content: userMessage }],
    systemPrompt + INSTRUCAO_FEEDBACK,
    8000
  );
  return separarFeedback(raw);
}

/**
 * Refina uma minuta já gerada com base em uma instrução do usuário,
 * mantendo o histórico da conversa para contexto.
 * @param {Object} params
 * @param {string} params.textoAtual - Texto atual da minuta
 * @param {string} params.mensagem - Instrução do usuário
 * @param {Array}  params.historico - Array de {role, content} com o histórico anterior
 * @returns {Promise<string>} - Texto da minuta refinada
 */
async function refinarMinuta({ textoAtual, mensagem, historico }) {
  const systemPrompt = `Você é o Assistente Regulatório do grupo Rumo, especializado em redigir e refinar respostas institucionais a ofícios da ANTT.

Você está no modo de REFINAMENTO COLABORATIVO. Sua tarefa é:
1. Entender a instrução do usuário sobre a minuta atual
2. Aplicar a modificação solicitada mantendo o tom formal técnico-jurídico
3. Retornar o TEXTO COMPLETO DA MINUTA após a modificação

PADRÕES OBRIGATÓRIOS:
- Tom: formal técnico-jurídico, nunca coloquial
- Tratamento: "Vossa Senhoria" para diretores/superintendentes
- Verbos na terceira pessoa do singular
- Normas: NÃO citar normas que regulam procedimentos internos da ANTT (ex: regras de dilação de prazo no SEI, ritos processuais). Citar apenas normas diretamente relevantes ao mérito da questão respondida.
- Objetividade: Formular pedidos e informações de forma direta e concisa. Evitar parênteses explicativos longos com referências documentais. Exemplo correto: "requerer nova dilação de prazo de 30 (trinta) dias para o cumprimento da obrigação".
- Retornar SEMPRE o texto completo atualizado, nunca apenas um trecho
- NUNCA adicione títulos, prefixos ("Minuta Refinada:", "Minuta:") ou comentários antes do texto
- Comece diretamente com o primeiro parágrafo da minuta
- O ÚLTIMO PARÁGRAFO do corpo deve ser SEMPRE: "Sendo o que nos cumpria no momento, permanecemos à disposição para quaisquer esclarecimentos ou informações adicionais." — preserve-o em qualquer refinamento, salvo instrução explícita do usuário para alterá-lo.

Quando o usuário pedir uma modificação, aplique-a com precisão e retorne a minuta completa e reformulada.
Quando o usuário fizer uma pergunta, responda brevemente e depois apresente a minuta atualizada (mesmo que sem mudanças).
No bloco de feedback, o campo "resumo" deve descrever especificamente O QUE VOCÊ ALTEROU nesta interação (ex: "Reformulei o 3º parágrafo em tom mais objetivo e removi a menção à Resolução X").`;

  // Monta o histórico da conversa, iniciando com a minuta atual no primeiro turno
  const messages = [];

  if (historico.length === 0) {
    // Primeira interação: inclui a minuta completa no contexto
    messages.push({
      role: 'user',
      content: `Esta é a minuta atual que precisa ser refinada:\n\n---\n${textoAtual}\n---\n\nMinha solicitação: ${mensagem}`,
    });
  } else {
    // Interações subsequentes: reconstrói o histórico
    messages.push({
      role: 'user',
      content: `Esta é a minuta atual que precisa ser refinada:\n\n---\n${historico[0].minutaRef || textoAtual}\n---\n\nMinha solicitação: ${historico[0].content}`,
    });
    for (let i = 1; i < historico.length; i++) {
      messages.push({ role: historico[i].role, content: historico[i].content });
    }
    messages.push({ role: 'user', content: mensagem });
  }

  const raw = await callClaude(messages, systemPrompt + INSTRUCAO_FEEDBACK, 8000);
  return separarFeedback(raw);
}

/**
 * Gera uma carta espontânea da Rumo dirigida à ANTT (sem ofício de entrada).
 */
async function gerarCartaEspontanea({ malha: malhaKey, destinatario, cargoDestinatario, area, referencia, processo, assunto, textoModelosReferencia, templateHint, usaTemplate, contextosAdicionais }) {
  const malhas = resolverMalhas(malhaKey);
  const textoMalhas = gerarTextoMalhas(malhas);
  const malhaIdentificada = textoMalhas?.identificacao || '[ENTIDADE DO GRUPO RUMO]';
  const aberturaObrigatoria = textoMalhas?.abertura
    || 'A [ENTIDADE DO GRUPO RUMO], concessionária prestadora do serviço público de transporte ferroviário de cargas,';

  const systemPrompt = `Você é o Assistente Regulatório do grupo Rumo, especializado em redigir comunicações institucionais formais à ANTT. Você produz cartas de alta qualidade, prontas para aprovação e assinatura.

PADRÕES OBRIGATÓRIOS:
- Tom: formal técnico-jurídico, nunca coloquial
- Tratamento: "Vossa Senhoria" para diretores/superintendentes
- Verbos na terceira pessoa do singular
- Linguagem: terminologia do setor ferroviário e regulatório
- Estrutura: abertura protocolar → desenvolvimento do assunto → encerramento formal
- Normas: NÃO citar normas que regulam procedimentos internos da ANTT (ex: regras de dilação de prazo no SEI, ritos processuais). Citar apenas normas diretamente relevantes ao mérito da questão respondida.
- Objetividade: Formular pedidos e informações de forma direta e concisa. Evitar parênteses explicativos longos com referências documentais. Exemplo correto: "requerer nova dilação de prazo de 30 (trinta) dias para o cumprimento da obrigação".

ENTIDADE REMETENTE: ${malhaIdentificada}

${textoModelosReferencia ? `MODELOS DE REFERÊNCIA (use o estilo e vocabulário destes documentos):\n${textoModelosReferencia.substring(0, 8000)}` : ''}

ESTILO DO DOCUMENTO:
${templateHint || 'Tom formal padrão.'}

${usaTemplate ? `FORMATO DO OUTPUT — INSTRUÇÃO CRÍTICA:
O documento final será montado a partir de um template DOCX com cabeçalho, endereçamento, saudação e assinatura já formatados.
Gere APENAS os parágrafos do corpo da carta — o conteúdo entre a saudação e o "Atenciosamente,".
NÃO inclua: cabeçalho, número, data, destinatário, saudação ("Prezada..."), "Atenciosamente,", nome do signatário, cargo nem rodapé.
Comece diretamente com o primeiro parágrafo.` : ''}`;

  const refParts = [];
  if (referencia) refParts.push(`Referência: ${referencia}`);
  if (processo) refParts.push(`Processo SEI: ${processo}`);

  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const userMessage = `Redija uma carta formal da ${textoMalhas?.nomesResumidos || '[ENTIDADE RUMO]'} dirigida à ANTT.

═══════════ TIPO ═══════════
Comunicação espontânea — a Rumo está tomando a iniciativa de comunicar algo à ANTT, SEM ter recebido ofício prévio.

═══════════ DESTINATÁRIO ═══════════
Nome: ${destinatario || '[NOME DO DESTINATÁRIO]'}
Cargo: ${cargoDestinatario || '[CARGO]'}
Área / Superintendência: ${area || '[ÁREA]'}

═══════════ ENTIDADE REMETENTE ═══════════
${malhaIdentificada}
${refParts.length ? '\n═══════════ REFERÊNCIAS ═══════════\n' + refParts.join('\n') : ''}

═══════════ ASSUNTO / CONTEÚDO A COMUNICAR ═══════════
${assunto}
${contextosAdicionais?.length ? `
═══════════ DOCUMENTOS COMPLEMENTARES (apenas contexto) ═══════════
Os documentos abaixo acompanham esta carta. Use-os para enriquecer o contexto e fundamentar afirmações quando relevante. NÃO responda ponto a ponto nem liste seus itens individualmente.

${contextosAdicionais.map(d => `[${d.nome}]\n${d.texto}`).join('\n\n---\n\n')}` : ''}

Data de emissão: São Paulo, ${dataHoje}

INSTRUÇÕES:
${usaTemplate ? `1. O PRIMEIRO PARÁGRAFO deve começar OBRIGATORIAMENTE com:
   "${aberturaObrigatoria} vem, respeitosamente, à presença de Vossa Senhoria para comunicar..."
2. Desenvolva o assunto de forma clara, formal e tecnicamente fundamentada
3. Estruture com parágrafos lógicos; use numeração se houver múltiplos pontos
4. O ÚLTIMO PARÁGRAFO deve ser OBRIGATORIAMENTE: "Sendo o que nos cumpria no momento, permanecemos à disposição para quaisquer esclarecimentos ou informações adicionais."
5. NÃO adicione cabeçalho, saudação, "Atenciosamente," ou assinatura — apenas os parágrafos do corpo
6. Gere APENAS o corpo da carta, sem comentários ou explicações adicionais (exceto o bloco de feedback ao final)` : `1. O PRIMEIRO PARÁGRAFO deve começar OBRIGATORIAMENTE com:
   "${aberturaObrigatoria} vem, respeitosamente, à presença de Vossa Senhoria para comunicar..."
2. Desenvolva o assunto de forma clara, formal e tecnicamente fundamentada
3. Estruture com parágrafos lógicos; use numeração se houver múltiplos pontos
4. O parágrafo antes de "Atenciosamente," deve ser OBRIGATORIAMENTE: "Sendo o que nos cumpria no momento, permanecemos à disposição para quaisquer esclarecimentos ou informações adicionais."
5. Numere a carta como OF.RUMO.DIR.REG.XXX/${new Date().getFullYear()}
6. Gere APENAS o texto da carta, sem comentários ou explicações adicionais (exceto o bloco de feedback ao final)`}`;

  const raw = await callClaude(
    [{ role: 'user', content: userMessage }],
    systemPrompt + INSTRUCAO_FEEDBACK,
    8000
  );
  return separarFeedback(raw);
}

/**
 * Gera um assunto conciso para a carta a partir de uma descrição longa e o nome das entidades.
 */
async function gerarAssuntoCurto(descricao, entidade) {
  const systemPrompt = `Você cria assuntos concisos de cartas formais no setor ferroviário/regulatório.
Responda APENAS com o texto do assunto — sem ponto final, sem aspas, sem explicações adicionais.
Formato preferencial: [Ação ou Tipo] - [Programa/Referência/Trecho] - [Entidade(s)]
Máximo 80 caracteres.
Exemplos: "Dilação de Prazo - COE - RMP", "Envio dos Documentos PSI - RMP", "Cisão de Trecho Jundiaí-Campinas"`;

  const userMessage = `Crie um assunto conciso para uma carta formal com base nesta descrição:\n${descricao.substring(0, 600)}${entidade ? `\nEntidade(s) remetente(s): ${entidade}` : ''}`;

  const resultado = await callClaude([{ role: 'user', content: userMessage }], systemPrompt, 100);
  return resultado.replace(/^["']|["']$/g, '').replace(/\.$/, '').trim();
}

module.exports = { callClaude, extrairBriefingOficio, extrairBriefingOficioPDF, gerarMinuta, refinarMinuta, gerarCartaEspontanea, gerarAssuntoCurto };
