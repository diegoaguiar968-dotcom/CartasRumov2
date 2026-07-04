/**
 * controllers/sharepointController.js
 * Registro de uma carta do histórico na lista do SharePoint, via webhook do
 * Power Automate. O segredo do webhook fica no servidor (env), nunca no browser.
 *
 * Retrocompatível: sem SHAREPOINT_WEBHOOK_URL, o endpoint responde 503 e o
 * frontend mantém o botão desabilitado com aviso.
 */

const { isEnabled, query } = require('../services/db');
const { gerarDocxDeEntrada } = require('./exportController');

/**
 * Modo de integração ativo, conforme as variáveis de ambiente:
 *  - 'forms'   → link de Microsoft Forms pré-preenchido (sem premium)
 *  - 'webhook' → POST para o Power Automate / Make (SHAREPOINT_WEBHOOK_URL)
 *  - 'none'    → não configurado (botão desabilitado no frontend)
 */
function sharepointMode() {
  if (process.env.SHAREPOINT_FORMS_URL_TEMPLATE) return 'forms';
  if (process.env.SHAREPOINT_WEBHOOK_URL) return 'webhook';
  return 'none';
}

/**
 * GET /api/historico/:id/forms-url
 * Substitui as sentinelas do template pelo valor da carta (URL-encoded) e
 * devolve o link do Forms já pré-preenchido para o usuário revisar e enviar.
 */
async function formsUrl(req, res, next) {
  const template = process.env.SHAREPOINT_FORMS_URL_TEMPLATE;
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
      ZZASSUNTOSZZ: e.assuntos || 'Resposta Ofício',
      ZZRESPONSAVELZZ: e.responsavel || '',
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

    const payload = {
      titulo: e.titulo || '',
      tema: e.tema || '',
      orgao: e.orgao || 'ANTT',
      malha: e.malha || '',
      oficio: e.oficio || '',
      processo: e.processo || '',
      formaEnvio: e.forma_envio || 'SEI',
      assuntos: e.assuntos || 'Resposta Ofício',
      responsavel: e.responsavel || '',
      responsavelEmail: e.responsavel_email || '',
      area: e.area || '',
      docxNome,
      docxBase64,
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

    const upd = await query(
      'UPDATE historico SET sharepoint_em = NOW() WHERE id = $1 RETURNING sharepoint_em',
      [e.id]
    );

    res.json({ success: true, itemUrl, registradoEm: upd.rows[0]?.sharepoint_em || new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

module.exports = { registrarSharePoint, formsUrl, sharepointMode };
