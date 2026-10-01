const leadRouterService = require('../../services/leadRouterService');

// Passthrough genérico hacia el Lead Router — el admin de esta unidad ya
// autenticó al usuario (authenticateToken + authenticateAdmin en la ruta),
// esto solo reenvía la llamada tal cual con la identidad del admin para que
// quede auditado del lado del router quién hizo cada cambio.
async function proxy(req, res) {
  try {
    const resultado = await leadRouterService.proxy({
      method: req.method,
      subpath: req.path,
      body: req.body,
      query: req.query,
      actingUser: req.user?.email,
    });
    res.status(resultado.status).json(resultado.data);
  } catch (error) {
    console.error('Error proxeando al Lead Router:', error.message);
    res.status(502).json({ message: 'No se pudo contactar al servicio del compensador de leads' });
  }
}

module.exports = { proxy };
