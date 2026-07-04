/**
 * ARCA — Assistente de Redação de Cartas para ANTT
 * Ponto de entrada principal da aplicação
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const modelRoutes = require('./routes/models');
const oficioRoutes = require('./routes/oficio');
const minutaRoutes = require('./routes/minuta');
const exportRoutes = require('./routes/export');
const historicoRoutes = require('./routes/historico');
const anttRoutes = require('./routes/antt');
const { requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { sessionMiddleware } = require('./middleware/session');
const { apiKeyMiddleware } = require('./middleware/apiKey');
const { carregarTemplatesFixos } = require('./services/templateService');
const { modelosPermanentes, initSessionsTable } = require('./services/store');
const { initDb } = require('./services/db');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Garantir que o diretório de uploads existe ───
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── CORS ───
// Se ALLOWED_ORIGINS (lista separada por vírgula) estiver definida, restringe
// aos domínios do frontend; caso contrário, mantém o comportamento aberto atual.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  exposedHeaders: ['Content-Disposition'],
  allowedHeaders: ['Content-Type', 'X-Session-ID', 'X-App-Key'],
  origin: allowedOrigins.length
    ? (origin, cb) => {
        // requisições sem Origin (curl, health checks) são permitidas
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('Origem não permitida pelo CORS'));
      }
    : true,
};

// ─── Middleware Global ───
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);
app.use(sessionMiddleware);

// ─── Chave de aplicação (protege /api/*; desativada se APP_KEY não definida) ───
app.use('/api', apiKeyMiddleware);

// ─── Rotas ───
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'ARCA — Backend rodando!',
    version: '2.0.0',
    ai: process.env.ANTHROPIC_API_KEY ? 'conectada' : 'desconectada (configure ANTHROPIC_API_KEY)',
  });
});

app.use('/api/models', modelRoutes);
app.use('/api/oficio', oficioRoutes);
app.use('/api/minuta', minutaRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/antt', anttRoutes);

// ─── /historico: o histórico agora vive dentro do app (vagão 06) ───
// Mantém o endereço antigo funcionando via redirect para o deep-link do frontend.
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://arcarumo.netlify.app';
app.get('/historico', (_req, res) => res.redirect(302, `${FRONTEND_URL}/#/historico`));

// ─── Catch-all 404 ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.url}`,
  });
});

// ─── Handler de Erros Global ───
app.use(errorHandler);

// ─── Inicializar ───
async function iniciar() {
  // Inicializa o banco de dados do histórico e das sessões (no-op se DATABASE_URL ausente)
  await initDb();
  await initSessionsTable();

  // Carrega os modelos DOCX fixos antes de aceitar requisições
  const templates = await carregarTemplatesFixos();
  modelosPermanentes.push(...templates);

  app.listen(PORT, () => {
    console.log('═'.repeat(50));
    console.log('ARCA — Backend v2.0');
    console.log('═'.repeat(50));
    console.log(`Porta: ${PORT}`);
    console.log(`Claude AI: ${process.env.ANTHROPIC_API_KEY ? 'configurada' : 'faltando ANTHROPIC_API_KEY'}`);
    console.log(`Templates fixos: ${modelosPermanentes.length} modelo(s) carregado(s)`);
    console.log('═'.repeat(50));
  });
}

iniciar();

module.exports = app;
