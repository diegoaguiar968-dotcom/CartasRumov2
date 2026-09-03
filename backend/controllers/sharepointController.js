/**
 * controllers/sharepointController.js
 * Registro de uma carta do histórico na lista do SharePoint, via webhook do
 * Power Automate. O segredo do webhook fica no servidor (env), nunca no browser.
 *
 * Retrocompatível: sem SHAREPOINT_WEBHOOK_URL, o endpoint responde 503 e o
 * frontend mantém o botão desabilitado com aviso.
 */

const fs = require('fs');
const { isEnabled, query } = require('../services/db');
const { gerarDocxDeEntrada } = require('./exportController');

// Template padrão do formulário de registro (Microsoft Forms, lista Cartas GREG).
// Pode ser sobrescrito pela env SHAREPOINT_FORMS_URL_TEMPLATE se o form mudar.
const DEFAULT_FORMS_TEMPLATE =
  'https://forms.office.com/Pages/ResponsePage.aspx?id=wul8g_owE0a57h8RTOcf8Tiu47VrLU5DjDJCXmVg6IVUQ0REVjdQMDlZU0VESUFIUjNRQzZWVzZFMi4u&r57880ed80f2344e6af0f06fbd0b6bb0b=ZZTITULOZZ&re69b8f2ac85e4dd78e4ef0209ad46f26=ZZEMAILZZ&r045a31c4078749c1bb7659569700e762=ZZAREAZZ&rcdf277bda4de42a9881225fe294777f8=ZZTEMAZZ&rcc48cb6f4c664727b3413952e8a41de7=ZZORGAOZZ&r0f6f9b5e5aeb4566ae97bb30cee1574a=ZZOFICIOZZ&r4c7c32818dfe485fb2296e8d5b8e256d=ZZMALHAZZ&r718a1fc8184f468089599a25c595492f=ZZFORMAZZ&re2a4d209bbb04177bc2bd871da947884=ZZPROCESSOZZ&r081891072b7a4311aa596f4939a4b95a=ZZASSUNTOSZZ';

function formsTemplate() {
  return process.env.SHAREPOINT_FORMS_URL_TEMPLATE || DEFAULT_FORMS_TEMPLATE || '';
}

// Opções da coluna "Assuntos" no SharePoint, exatamente como cadastradas lá.
// Um valor com grafia diferente não casa com nenhuma opção e é criado como
// escolha nova (aparece sem cor na lista) — por isso normalizamos antes de enviar.
const ASSUNTOS_CANONICOS = [
  'Patrimônio',
  'Ativos',
  'Passivos',
  'Interferências',
  'DUP',
  'Investimentos Obrigatórios',
  'Obrigações Contratuais',
  'Indicadores',
  'Acidentes',
  'Solicitação de acesso',
  'Fiscalização',
  'Projeto de RDT/RPMF',
  'Resposta Ofício',
  'Outros',
];

/** Remove acentos e caixa, para comparar rótulos escritos de formas diferentes. */
function chaveComparacao(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const MAPA_ASSUNTOS = new Map(ASSUNTOS_CANONICOS.map((a) => [chaveComparacao(a), a]));
// Grafias antigas que já foram gravadas no histórico
MAPA_ASSUNTOS.set(chaveComparacao('RDT e RPMF'), 'Projeto de RDT/RPMF');
MAPA_ASSUNTOS.set(chaveComparacao('outro'), 'Outros');

/**
 * Converte o assunto gravado para a grafia exata do SharePoint.
 * Aceita múltiplos assuntos separados por ";" ou ",". Valores desconhecidos
 * são preservados como vieram (melhor registrar algo do que perder o dado).
 */
function normalizarAssuntos(valor) {
  const partes = String(valor || '')
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!partes.length) return '';
  return partes.map((p) => MAPA_ASSUNTOS.get(chaveComparacao(p)) || p).join(';');
}

/**
 * Modo de integração ativo:
 *  - 'forms'   → link de Microsoft Forms pré-preenchido (sem premium)
 *  - 'webhook' → POST para o Power Automate / Make (SHAREPOINT_WEBHOOK_URL)
 *  - 'none'    → não configurado (botão oculto no frontend)
 *
 * Ordem de decisão:
 *  1. SHAREPOINT_MODE (forms|webhook|none) força o modo explicitamente;
 *  2. senão, se houver SHAREPOINT_WEBHOOK_URL, usa 'webhook' (registro automático);
 *  3. senão, se houver template de Forms, usa 'forms';
 *  4. senão, 'none'.
 * Assim, definir a URL do webhook já ativa o modo automático mesmo com o
 * template padrão de Forms embutido no código.
 */
function sharepointMode() {
  const forcado = String(process.env.SHAREPOINT_MODE || '').trim().toLowerCase();
  if (forcado === 'forms' || forcado === 'webhook' || forcado === 'none') return forcado;
  if (process.env.SHAREPOINT_WEBHOOK_URL) return 'webhook';
  if (formsTemplate()) return 'forms';
  return 'none';
}

/**
 * GET /api/historico/:id/forms-url
 * Substitui as sentinelas do template pelo valor da carta (URL-encoded) e
 * devolve o link do Forms já pré-preenchido para o usuário revisar e enviar.
 */
async function formsUrl(req, res, next) {
  const template = formsTemplate();
  if (!template) {
    return res.status(503).json({ success: false, message: 'Integração via formulário não configurada.' });
  }
  if (!isEnabled()) {
    return res.status(503).json({ success: false, message: 'Banco de dados não configurado.' });
  }
  try {
    const { rows } = await query('SELECT * FROM historico WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Entrada não encontrada.' });
    const e = rows[0];

    const mapa = {
      ZZTITULOZZ: e.titulo || '',
      ZZTEMAZZ: e.tema || '',
      ZZORGAOZZ: e.orgao || 'ANTT',
      ZZMALHAZZ: e.malha || '',
      ZZOFICIOZZ: e.oficio || '',
      ZZPROCESSOZZ: e.processo || '',
      ZZAREAZZ: e.area || '',
      ZZFORMAZZ: e.forma_envio || 'SEI',
      ZZASSUNTOSZZ: normalizarAssuntos(e.assuntos) || 'Resposta Ofício',
      ZZRESPONSAVELZZ: e.responsavel || '',
      ZZEMAILZZ: e.responsavel_email || '',
    };

    let url = template;
    for (const [sentinela, valor] of Object.entries(mapa)) {
      url = url.split(sentinela).join(encodeURIComponent(valor));
    }

    res.json({ success: true, url });
  } catch (err) {
    next(err);
  }
}

// Biblioteca e caminho onde as pastas das cartas são criadas. O padrão reproduz
// a organização já usada manualmente pela equipe; ajustável por env.
const PASTA_BIBLIOTECA = () => process.env.SHAREPOINT_BIBLIOTECA || 'Pasta Regulatorio';
const PASTA_CAMINHO = () => process.env.SHAREPOINT_PASTA_CAMINHO || 'Cartas e Oficios/Cartas/Cartas 2026';

/** Caracteres proibidos em nomes de pasta/arquivo no SharePoint. */
function sanitizarNomeSharePoint(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|#%{}~&]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.') // evita "Recibo protocolo .pdf" ao remover caracteres
    .trim()
    .replace(/[. ]+$/, ''); // SharePoint não aceita terminar com ponto ou espaço
}

/**
 * Nome da pasta da carta, no padrão usado pela equipe:
 *   "NNNN - ÓRGÃO - MALHA - Assunto"
 * Ex.: "0536 - ANTT - RMO - Informação sobre reunião do Conselho"
 */
function nomePastaCarta(e) {
  const numero = (String(e.titulo || '').match(/\d+/) || ['0000'])[0].padStart(4, '0');
  const orgao = sanitizarNomeSharePoint(e.orgao || 'ANTT');
  const malha = sanitizarNomeSharePoint(e.malha || '');
  const assunto = sanitizarNomeSharePoint(e.tema || 'Carta');
  const partes = [numero, orgao, malha, assunto].filter(Boolean);
  // O caminho completo no SharePoint tem limite prático de ~400 chars
  return partes.join(' - ').substring(0, 180).replace(/[. ]+$/, '');
}

/**
 * Lê os arquivos enviados via multipart e devolve no formato do payload,
 * já em base64. Usado tanto no registro quanto na criação da pasta.
 */
function anexosDoRequest(req) {
  const arquivos = [
    ...(req.files?.anexos || []),
    ...(req.files?.files || []),
    ...(req.file ? [req.file] : []),
  ];
  return arquivos.map((a) => ({
    nome: sanitizarNomeSharePoint(a.originalname) || 'anexo',
    conteudoBase64: fs.readFileSync(a.path).toString('base64'),
    tamanho: a.size,
  }));
}

/** Remove os temporários do multer depois de montar o payload. */
function limparTemporarios(req) {
  const arquivos = [
    ...(req.files?.anexos || []),
    ...(req.files?.files || []),
    ...(req.file ? [req.file] : []),
  ];
  for (const a of arquivos) {
    fs.unlink(a.path, () => {});
  }
}

async function registrarSharePoint(req, res, next) {
  const webhook = process.env.SHAREPOINT_WEBHOOK_URL;
  if (!webhook) {
    return res.status(503).json({
      success: false,
      message: 'Integração com o SharePoint não configurada (defina SHAREPOINT_WEBHOOK_URL no servidor).',
    });
  }
  if (!isEnabled()) {
    return res.status(503).json({ success: false, message: 'Banco de dados não configurado.' });
  }

  try {
    const { rows } = await query('SELECT * FROM historico WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Entrada não encontrada.' });
    const e = rows[0];

    const anexos = anexosDoRequest(req);
    limparTemporarios(req);

    // Gera o .docx a partir da entrada (o fluxo decide se anexa)
    let docxBase64 = '';
    let docxNome = e.nome_arquivo || '';
    try {
      const doc = await gerarDocxDeEntrada(e);
      docxBase64 = doc.buffer.toString('base64');
      docxNome = doc.nomeArquivo;
    } catch (err) {
      console.warn('[SharePoint] Falha ao gerar DOCX para anexo:', err.message);
    }

    if (anexos.length) {
      console.log(`[SharePoint] Registrando com ${anexos.length} anexo(s) além do .docx.`);
    }

    const payload = {
      titulo: e.titulo || '',
      tema: e.tema || '',
      orgao: e.orgao || 'ANTT',
      malha: e.malha || '',
      oficio: e.oficio || '',
      processo: e.processo || '',
      formaEnvio: e.forma_envio || 'SEI',
      assuntos: normalizarAssuntos(e.assuntos),
      responsavel: e.responsavel || '',
      responsavelEmail: e.responsavel_email || '',
      area: e.area || '',
      docxNome,
      docxBase64,
      // Arquivos extras anexados pelo usuário a esta carta (podem ser vários e
      // de qualquer formato). O fluxo percorre a lista e anexa cada um ao item.
      anexos,
      sharedSecret: process.env.SHAREPOINT_WEBHOOK_SECRET || '',
    };

    let resp;
    try {
      resp = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return res.status(502).json({ success: false, message: `Não foi possível contatar o fluxo do SharePoint: ${err.message}` });
    }

    if (!resp.ok) {
      const texto = await resp.text().catch(() => '');
      return res.status(502).json({
        success: false,
        message: `O fluxo do SharePoint retornou ${resp.status}. ${texto.slice(0, 200)}`.trim(),
      });
    }

    // Opcional: o fluxo pode retornar a URL do item criado
    let itemUrl = null;
    try {
      const j = await resp.json();
      itemUrl = j.itemUrl || j.ItemUrl || j.link || null;
    } catch {
      /* fluxo não retornou JSON — tudo bem */
    }

    // Sem URL do item, abre a própria lista para conferência (se configurada)
    if (!itemUrl && process.env.SHAREPOINT_LIST_URL) {
      itemUrl = process.env.SHAREPOINT_LIST_URL;
    }

    const upd = await query(
      'UPDATE historico SET sharepoint_em = NOW() WHERE id = $1 RETURNING sharepoint_em',
      [e.id]
    );

    res.json({ success: true, itemUrl, registradoEm: upd.rows[0]?.sharepoint_em || new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/historico/:id/sharepoint/pasta
 * Cria a pasta da carta na biblioteca de documentos e sobe o .docx mais todos
 * os anexos enviados. Usa um fluxo próprio do Power Automate
 * (SHAREPOINT_PASTA_WEBHOOK_URL) para não interferir no fluxo de registro que
 * já está em produção.
 */
async function criarPastaSharePoint(req, res, next) {
  const webhook = process.env.SHAREPOINT_PASTA_WEBHOOK_URL;
  if (!webhook) {
    limparTemporarios(req);
    return res.status(503).json({
      success: false,
      message:
        'Criação de pasta não configurada. Defina SHAREPOINT_PASTA_WEBHOOK_URL no servidor (veja o guia do Power Automate).',
    });
  }
  if (!isEnabled()) {
    limparTemporarios(req);
    return res.status(503).json({ success: false, message: 'Banco de dados não configurado.' });
  }

  try {
    const { rows } = await query('SELECT * FROM historico WHERE id = $1', [req.params.id]);
    if (!rows.length) {
      limparTemporarios(req);
      return res.status(404).json({ success: false, message: 'Entrada não encontrada.' });
    }
    const e = rows[0];

    const anexos = anexosDoRequest(req);
    limparTemporarios(req);

    // O .docx da carta entra na pasta junto com os anexos
    const arquivos = [...anexos];
    try {
      const doc = await gerarDocxDeEntrada(e);
      arquivos.unshift({
        nome: sanitizarNomeSharePoint(doc.nomeArquivo),
        conteudoBase64: doc.buffer.toString('base64'),
        tamanho: doc.buffer.length,
      });
    } catch (err) {
      console.warn('[SharePoint] Falha ao gerar DOCX para a pasta:', err.message);
    }

    if (!arquivos.length) {
      return res.status(400).json({ success: false, message: 'Nenhum arquivo para enviar à pasta.' });
    }

    const pastaNome = nomePastaCarta(e);
    const payload = {
      acao: 'criarPasta',
      pastaNome,
      biblioteca: PASTA_BIBLIOTECA(),
      caminho: PASTA_CAMINHO(),
      titulo: e.titulo || '',
      tema: e.tema || '',
      orgao: e.orgao || 'ANTT',
      malha: e.malha || '',
      responsavel: e.responsavel || '',
      responsavelEmail: e.responsavel_email || '',
      arquivos,
      sharedSecret: process.env.SHAREPOINT_WEBHOOK_SECRET || '',
    };

    const totalMb = (JSON.stringify(payload).length / 1024 / 1024).toFixed(1);
    console.log(`[SharePoint] Criando pasta "${pastaNome}" com ${arquivos.length} arquivo(s) (~${totalMb} MB).`);

    let resp;
    try {
      resp = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return res.status(502).json({ success: false, message: `Não foi possível contatar o fluxo da pasta: ${err.message}` });
    }

    if (!resp.ok) {
      const texto = await resp.text().catch(() => '');
      return res.status(502).json({
        success: false,
        message: `O fluxo da pasta retornou ${resp.status}. ${texto.slice(0, 200)}`.trim(),
      });
    }

    let pastaUrl = null;
    try {
      const j = await resp.json();
      pastaUrl = j.pastaUrl || j.folderUrl || j.itemUrl || j.link || null;
    } catch {
      /* fluxo não retornou JSON — tudo bem */
    }

    res.json({ success: true, pastaNome, pastaUrl, arquivos: arquivos.length });
  } catch (err) {
    limparTemporarios(req);
    next(err);
  }
}

module.exports = { registrarSharePoint, criarPastaSharePoint, formsUrl, sharepointMode };
