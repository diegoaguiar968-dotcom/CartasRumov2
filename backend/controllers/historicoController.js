/**
 * controllers/historicoController.js
 * Histórico compartilhado de cartas geradas — persistido no Postgres (Supabase).
 */

const { isEnabled, query } = require('../services/db');

/**
 * Salva uma entrada de histórico. Chamado internamente após um export bem-sucedido.
 * Nunca lança — em caso de erro apenas registra no log (fire-and-forget).
 * @param {Object} dados
 */
async function salvarHistorico(dados) {
  if (!isEnabled()) return;
  try {
    await query(
      `INSERT INTO historico
        (titulo, nome_arquivo, responsavel, responsavel_email, area, assuntos, tema, orgao, malha,
         oficio, processo, forma_envio, modelo_id, minuta, signatario_antt, cargo_antt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        dados.titulo || '',
        dados.nomeArquivo || '',
        dados.responsavel || '',
        dados.responsavelEmail || '',
        dados.area || '',
        dados.assuntos ?? 'Resposta a Ofício',
        dados.tema || '',
        dados.orgao || 'ANTT',
        dados.malha || '',
        dados.oficio || '',
        dados.processo || '',
        dados.formaEnvio || 'SEI',
        dados.modeloId || '',
        dados.minuta || '',
        dados.signatarioAntt || '',
        dados.cargoAntt || '',
      ]
    );
    console.log('[Histórico] Entrada salva:', dados.titulo || dados.nomeArquivo);
  } catch (err) {
    console.error('[Histórico] Falha ao salvar:', err.message);
  }
}

/**
 * GET /api/historico — lista paginada com filtros opcionais.
 * Query params: q (busca livre), responsavel, malha, orgao, de, ate (ISO),
 *               limit (padrão 50, máx 200), offset (padrão 0).
 * Retorna { historico, total, offset, limit } para paginação incremental.
 */
async function listarHistorico(req, res, next) {
  try {
    if (!isEnabled()) {
      return res.json({ success: true, historico: [], total: 0, dbDesativado: true });
    }

    const { q, responsavel, malha, orgao, de, ate } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const cond = [];
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      cond.push(`(titulo ILIKE $${i} OR tema ILIKE $${i} OR oficio ILIKE $${i} OR processo ILIKE $${i} OR responsavel ILIKE $${i})`);
    }
    if (responsavel) { params.push(responsavel); cond.push(`responsavel = $${params.length}`); }
    if (malha)       { params.push(malha);       cond.push(`malha = $${params.length}`); }
    if (orgao)       { params.push(orgao);        cond.push(`orgao = $${params.length}`); }
    if (de)          { params.push(de);           cond.push(`criado_em >= $${params.length}`); }
    if (ate)         { params.push(ate);          cond.push(`criado_em <= $${params.length}`); }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const totalRes = await query(`SELECT COUNT(*)::int AS total FROM historico ${where}`, params);
    const total = totalRes.rows[0]?.total || 0;

    // Lista não retorna a minuta completa (economia de payload)
    const { rows } = await query(
      `SELECT id, criado_em, titulo, nome_arquivo, responsavel, area, assuntos,
              tema, orgao, malha, oficio, processo, forma_envio, modelo_id,
              signatario_antt, cargo_antt, sharepoint_em
       FROM historico ${where}
       ORDER BY criado_em DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, historico: rows, total, offset, limit });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/historico/opcoes — valores distintos para popular os filtros.
 */
async function opcoesFiltro(_req, res, next) {
  try {
    if (!isEnabled()) return res.json({ success: true, responsaveis: [], malhas: [], orgaos: [] });
    const [resp, malhas, orgaos] = await Promise.all([
      query(`SELECT DISTINCT responsavel FROM historico WHERE responsavel <> '' ORDER BY responsavel`),
      query(`SELECT DISTINCT malha FROM historico WHERE malha <> '' ORDER BY malha`),
      query(`SELECT DISTINCT orgao FROM historico WHERE orgao <> '' ORDER BY orgao`),
    ]);
    res.json({
      success: true,
      responsaveis: resp.rows.map(r => r.responsavel),
      malhas: malhas.rows.map(r => r.malha),
      orgaos: orgaos.rows.map(r => r.orgao),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/historico/proximo-numero — sugere o próximo número sequencial do ano.
 * Baseia-se no maior NNNN de titulo 'NNNN/GREG/AAAA' do ano corrente:
 * histórico vazio ou virada de ano → 1; números manuais fora de sequência
 * são absorvidos pelo MAX.
 */
async function proximoNumero(_req, res, next) {
  try {
    const ano = new Date().getFullYear();
    if (!isEnabled()) return res.json({ success: true, proximo: null, ano });
    const { rows } = await query(
      `SELECT MAX(CAST(SPLIT_PART(titulo, '/', 1) AS INTEGER)) AS maior
         FROM historico
        WHERE titulo ~ ('^\\d+/GREG/' || $1 || '$')`,
      [String(ano)]
    );
    const maior = rows[0]?.maior || 0;
    res.json({ success: true, proximo: maior + 1, ano });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/historico/numero-existe?numero=0007 — verifica colisão no ano corrente.
 */
async function numeroExiste(req, res, next) {
  try {
    if (!isEnabled()) return res.json({ success: true, existe: false });
    const seq = String(req.query.numero || '').replace(/\D/g, '').padStart(4, '0');
    if (!seq || seq === '0000') return res.json({ success: true, existe: false });
    const ano = new Date().getFullYear();
    const { rows } = await query(
      `SELECT 1 FROM historico WHERE titulo = $1 LIMIT 1`,
      [`${seq}/GREG/${ano}`]
    );
    res.json({ success: true, existe: rows.length > 0 });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/historico/:id — detalhes completos (inclui a minuta).
 */
async function detalheHistorico(req, res, next) {
  try {
    if (!isEnabled()) return res.status(503).json({ success: false, message: 'Banco de dados não configurado.' });
    const { rows } = await query(`SELECT * FROM historico WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Entrada não encontrada.' });
    res.json({ success: true, entrada: rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/historico/:id — edita campos de atribuição (responsável/área/assuntos).
 */
async function atualizarHistorico(req, res, next) {
  try {
    if (!isEnabled()) return res.status(503).json({ success: false, message: 'Banco de dados não configurado.' });
    const { responsavel, area, assuntos } = req.body || {};
    const { rows } = await query(
      `UPDATE historico
         SET responsavel = COALESCE($1, responsavel),
             area        = COALESCE($2, area),
             assuntos    = COALESCE($3, assuntos)
       WHERE id = $4
       RETURNING id, responsavel, area, assuntos`,
      [responsavel ?? null, area ?? null, assuntos ?? null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Entrada não encontrada.' });
    res.json({ success: true, entrada: rows[0] });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/historico/:id
 */
async function excluirHistorico(req, res, next) {
  try {
    if (!isEnabled()) return res.status(503).json({ success: false, message: 'Banco de dados não configurado.' });
    await query(`DELETE FROM historico WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  salvarHistorico,
  listarHistorico,
  opcoesFiltro,
  proximoNumero,
  numeroExiste,
  detalheHistorico,
  atualizarHistorico,
  excluirHistorico,
};
