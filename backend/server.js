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
const { carregarTemplatesFixos } = require('./services/templateService');
const { modelosPermanentes } = require('./services/store');

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

// ─── Rota Raiz (IMPORTANTE PARA O RENDER) ───
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Agente Rumo — Backend Online',
    timestamp: new Date().toISOString()
  });
});

// ─── Rotas da API ───
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    message: 'Agente Rumo — Backend rodando!',
    version: '2.0.0',
    // Corrigido para refletir a chave real que você está usando
    ai: process.env.GEMINI_API_KEY ? 'Gemini Conectado' : 'Gemini Desconectado',
  });
});

app.use('/api/models', modelRoutes);
app.use('/api/oficio', oficioRoutes);
app.use('/api/minuta', minutaRoutes);
app.use('/api/export', exportRoutes);

// ─── Catch-all 404 (Sempre após as rotas) ───
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Rota não encontrada: ${req.method} ${req.url}`,
  });
});

// ─── Handler de Erros Global (Sempre por último) ───
app.use(errorHandler);

// ─── Inicializar ───
async function iniciar() {
  try {
    // Carrega os modelos DOCX fixos antes de aceitar requisições
    const templates = await carregarTemplatesFixos();
    if (templates && templates.length > 0) {
      modelosPermanentes.push(...templates);
    }

    app.listen(PORT, () => {
      console.log('═'.repeat(50));
      console.log(`Agente Rumo — Backend v2.0`);
      console.log(`Porta: ${PORT}`);
      console.log(`AI Status: ${process.env.GEMINI_API_KEY ? 'Configurada' : 'Faltando GEMINI_API_KEY'}`);
      console.log(`Templates: ${modelosPermanentes.length} carregado(s)`);
      console.log('═'.repeat(50));
    });
  } catch (error) {
    console.error("Erro ao iniciar o servidor:", error);
    process.exit(1); // Fecha o app se houver erro crítico na inicialização
  }
}

iniciar();

module.exports = app;
