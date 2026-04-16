/**
 * middleware/errorHandler.js
 * Centraliza o tratamento de erros da aplicação
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  console.error(`[Erro] ${req.method} ${req.url} →`, err.message);

  // Erros de upload (multer)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Arquivo muito grande. Limite: 15 MB.' });
  }
  if (err.message === 'Apenas arquivos PDF são permitidos') {
    return res.status(415).json({ success: false, message: err.message });
  }

  // Erro de API key não configurada
  if (err.message.includes('ANTHROPIC_API_KEY')) {
    return res.status(503).json({
      success: false,
      message: 'Serviço de IA não configurado. Configure a variável ANTHROPIC_API_KEY no servidor.',
    });
  }

  // Erro genérico
  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor.',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

module.exports = { errorHandler };
