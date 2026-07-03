const { hasSession, loadSession, persistSession } = require('../services/store');

async function sessionMiddleware(req, res, next) {
  req.sessionId = req.headers['x-session-id'] || 'anonymous';

  // Reidrata do banco após restart/hibernação (no-op se já em memória ou sem DB)
  if (!hasSession(req.sessionId)) {
    try {
      await loadSession(req.sessionId);
    } catch {
      /* segue com sessão em memória */
    }
  }

  // Persiste a sessão ao fim de requisições que a modificam (POST)
  if (req.method === 'POST') {
    res.on('finish', () => {
      persistSession(req.sessionId).catch(() => {});
    });
  }

  next();
}

module.exports = { sessionMiddleware };
