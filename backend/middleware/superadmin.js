import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'

/**
 * Middleware para validar que el usuario es Super Administrador
 */
export const requireSuperAdmin = (req, res, next) => {
  try {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado: Token no proporcionado' })
    }

    const token = auth.split(' ')[1]
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' })
    }

    if (decoded.rol !== 'superadmin') {
      return res.status(403).json({ error: 'Acceso denegado: Se requiere rol de Super Administrador' })
    }

    req.user = decoded
    req.rol = 'superadmin'
    next()
  } catch (err) {
    console.error('Error en middleware requireSuperAdmin:', err)
    return res.status(500).json({ error: 'Error de autenticación SuperAdmin' })
  }
}
