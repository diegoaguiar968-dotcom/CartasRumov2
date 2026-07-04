/**
 * services/db.js
 * Conexão com o banco de dados Postgres (Supabase) para o histórico de cartas.
 *
 * Degradação graciosa: se DATABASE_URL não estiver configurada, o app continua
 * funcionando normalmente — apenas o histórico fica desativado (sem salvar/listar).
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let dbReady = false;

if (DATABASE_URL) {
  // SSL ligado por padrão (exigido por Supabase/Render). Pode ser desligado
  // com DATABASE_SSL=false para bancos locais/de teste sem TLS.
  const usarSsl = process.env.DATABASE_SSL !== 'false';
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: usarSsl ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
  });

  pool.on('error', (err) => {
    console.error('[DB] Erro inesperado no pool:', err.message);
  });
} else {
  console.warn('[DB] DATABASE_URL não configurada — histórico desativado.');
}

/**
 * Cria a tabela de histórico se ainda não existir.
 */
async function initDb() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS historico (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        titulo          TEXT        DEFAULT '',
        nome_arquivo    TEXT        DEFAULT '',
        responsavel     TEXT        DEFAULT '',
        area            TEXT        DEFAULT '',
        assuntos        TEXT        DEFAULT 'Resposta Ofício',
        tema            TEXT        DEFAULT '',
        orgao           TEXT        DEFAULT 'ANTT',
        malha           TEXT        DEFAULT '',
        oficio          TEXT        DEFAULT '',
        processo        TEXT        DEFAULT '',
        forma_envio     TEXT        DEFAULT 'SEI',
        modelo_id       TEXT        DEFAULT '',
        minuta          TEXT        DEFAULT '',
        signatario_antt TEXT        DEFAULT '',
        cargo_antt      TEXT        DEFAULT ''
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_historico_criado_em ON historico (criado_em DESC);`);
    // Migrações idempotentes (colunas adicionadas depois da criação original)
    await pool.query(`ALTER TABLE historico ADD COLUMN IF NOT EXISTS responsavel_email TEXT DEFAULT ''`);
    await pool.query(`ALTER TABLE historico ADD COLUMN IF NOT EXISTS sharepoint_em TIMESTAMPTZ`);
    dbReady = true;
    console.log('[DB] Conectado ao Postgres — tabela de histórico pronta.');
  } catch (err) {
    console.error('[DB] Falha ao inicializar tabela:', err.message);
  }
}

function isEnabled() {
  return !!pool;
}

async function query(text, params) {
  if (!pool) throw new Error('Banco de dados não configurado (DATABASE_URL ausente).');
  return pool.query(text, params);
}

module.exports = { initDb, isEnabled, query };
