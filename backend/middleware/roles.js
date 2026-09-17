/**
 * Middleware para requerir rol de Administrador
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  if (req.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Administrador' })
  }

  next()
}

/**
 * Middleware para verificar acceso de Colaborador o Administrador
 */
export const requireColaboradorOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' })
  }

  if (!['colaborador', 'admin'].includes(req.rol)) {
    return res.status(403).json({ error: 'Acceso denegado: Rol insuficiente' })
  }

  next()
}
