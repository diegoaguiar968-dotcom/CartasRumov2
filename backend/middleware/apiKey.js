/**
 * middleware/apiKey.js
 * Exige uma chave de aplicação (header X-App-Key) nas rotas /api.
 *
 * Retrocompatível: se a variável de ambiente APP_KEY não estiver definida,
 * a verificação fica DESATIVADA e a API se comporta como antes. Isso permite
 * publicar o código sem quebrar o site — a proteção só passa a valer quando
 * você define APP_KEY no Render (e window.APP_KEY no frontend).
 *
 * Ordem de ativação recomendada (para não derrubar o app):
 *   1) definir window.APP_KEY no index.html do frontend e publicar;
 *   2) só então definir APP_KEY (mesmo valor) no Render.
 */
function apiKeyMiddleware(req, res, next) {
  const required = process.env.APP_KEY;
  if (!required) return next(); // desativado enquanto não configurado

  if (req.method === 'OPTIONS') return next(); // preflight CORS
  if (req.path === '/status') return next();    // healthcheck

  const provided = req.headers['x-app-key'];
  if (provided && provided === required) return next();

  return res.status(401).json({ success: false, message: 'Não autorizado.' });
}

module.exports = { apiKeyMiddleware };
