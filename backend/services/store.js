/**
 * services/store.js
 * Armazenamento isolado por sessão, em memória com persistência opcional no Postgres.
 *
 * Cada usuário recebe um UUID (X-Session-ID) gerado no frontend. A sessão vive
 * em memória (rápida) e, quando há banco configurado, é espelhada numa tabela
 * `sessions` (JSONB). Isso permite reidratar a sessão após um redeploy ou a
 * hibernação do Render, sem o usuário perder o ofício/minuta em andamento.
 *
 * Degradação graciosa: sem DATABASE_URL, comporta-se como antes (só memória).
 * modelosPermanentes é global — carregado na inicialização e compartilhado.
 */

const { isEnabled, query } = require('./db');

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas

const sessions = new Map();

function createSessionData() {
  return {
    modelos: [],
    oficios: [],
    documentosComplementares: [],
    ultimaMinuta: {
      texto: '',
      signatario: '',
      cargo: '',
      modeloId: 'objetiva',
      signatarioAntt: '',
      cargoAntt: '',
      processo: '',
      assunto: '',
      referencia: '',
      malha: '',
    },
    lastActivity: Date.now(),
  };
}

function getSession(sessionId) {
  const key = sessionId || 'anonymous';
  let session = sessions.get(key);
  if (!session) {
    session = createSessionData();
    sessions.set(key, session);
  }
  session.lastActivity = Date.now();
  return session;
}

function hasSession(sessionId) {
  return sessions.has(sessionId || 'anonymous');
}

// ─── Persistência opcional no Postgres ───

async function initSessionsTable() {
  if (!isEnabled()) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id  TEXT PRIMARY KEY,
        data        JSONB NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error('[Sessão] Falha ao criar tabela sessions:', err.message);
  }
}

/**
 * Reidrata a sessão do banco para a memória (usado após restart).
 * Não sobrescreve uma sessão que já esteja em memória.
 */
async function loadSession(sessionId) {
  const key = sessionId || 'anonymous';
  if (!isEnabled() || sessions.has(key)) return false;
  try {
    const { rows } = await query('SELECT data FROM sessions WHERE session_id = $1', [key]);
    if (!rows.length) return false;
    const data = rows[0].data || {};
    const base = createSessionData();
    sessions.set(key, {
      ...base,
      ...data,
      ultimaMinuta: { ...base.ultimaMinuta, ...(data.ultimaMinuta || {}) },
      lastActivity: Date.now(),
    });
    return true;
  } catch (err) {
    console.error('[Sessão] Falha ao carregar do banco:', err.message);
    return false;
  }
}

/**
 * Espelha a sessão em memória para o banco (upsert). Fire-and-forget.
 */
async function persistSession(sessionId) {
  const key = sessionId || 'anonymous';
  const session = sessions.get(key);
  if (!isEnabled() || !session) return;
  try {
    await query(
      `INSERT INTO sessions (session_id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (session_id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [key, JSON.stringify(session)]
    );
  } catch (err) {
    console.error('[Sessão] Falha ao persistir no banco:', err.message);
  }
}

// Limpeza automática de sessões inativas (memória + banco)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
  if (isEnabled()) {
    query(
      `DELETE FROM sessions WHERE updated_at < NOW() - INTERVAL '2 hours'`
    ).catch((err) => console.error('[Sessão] Falha ao limpar sessões antigas:', err.message));
  }
}, 30 * 60 * 1000).unref();

// Modelos fixos carregados na inicialização — compartilhados entre todas as sessões
const modelosPermanentes = [];

module.exports = {
  getSession,
  hasSession,
  loadSession,
  persistSession,
  initSessionsTable,
  modelosPermanentes,
};
