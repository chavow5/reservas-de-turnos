import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'

/**
 * Middleware para validar autenticación de usuarios administradores o colaboradores del negocio
 */
export const verifyAuth = (req, res, next) => {
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

    req.user = decoded
    req.rol = decoded.rol || 'colaborador'

    next()
  } catch (err) {
    console.error('Error en middleware verifyAuth:', err)
    return res.status(500).json({ error: 'Error interno de autenticación' })
  }
}

