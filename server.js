/**
 * Agente Rumo — Backend
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
const { requestLogger } = require('./middleware/logger');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Garantir que o diretório de uploads existe ───
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─── Middleware Global ───
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestLogger);

// ─── Rotas ───
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Agente Rumo — Backend rodando!',
    version: '2.0.0',
    ai: process.env.ANTHROPIC_API_KEY ? 'conectada' : 'desconectada (configure ANTHROPIC_API_KEY)',
  });
});

app.use('/api/models', modelRoutes);
app.use('/api/oficio', oficioRoutes);
app.use('/api/minuta', minutaRoutes);
app.use('/api/export', exportRoutes);

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
app.listen(PORT, () => {
  console.log('═'.repeat(50));
  console.log('🚀  Agente Rumo — Backend v2.0');
  console.log('═'.repeat(50));
  console.log(`📡  Porta: ${PORT}`);
  console.log(`🤖  Claude AI: ${process.env.ANTHROPIC_API_KEY ? '✅ configurada' : '❌ faltando ANTHROPIC_API_KEY'}`);
  console.log('═'.repeat(50));
});

module.exports = app;
