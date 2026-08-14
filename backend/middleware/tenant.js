import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambiar-en-produccion'

/**
 * Middleware para validar que el usuario pertenece a un negocio y tiene un token válido
 */
export const verifyTenantUser = (supabase) => {
  return async (req, res, next) => {
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

      // Si es superadmin, tiene acceso general
      if (decoded.rol === 'superadmin') {
        req.user = decoded
        req.negocio_id = decoded.negocio_id || req.headers['x-negocio-id'] || null
        req.rol = 'superadmin'
        return next()
      }

      // Validar que el token contenga negocio_id
      if (!decoded.negocio_id) {
        return res.status(403).json({ error: 'Acceso denegado: Token sin negocio asignado' })
      }

      // Verificar que el negocio exista y esté activo
      const { data: negocio, error: negErr } = await supabase
        .from('negocios')
        .select('id, nombre, slug, activo, modo_prueba, monto_sena, mp_access_token')
        .eq('id', decoded.negocio_id)
        .single()

      if (negErr || !negocio) {
        // Fallback resiliente para los negocios semilla antes de correr la migración SQL
        if (decoded.negocio_id === '11111111-1111-1111-1111-111111111111' || decoded.slug === 'pruebas-reservas') {
          req.user = decoded
          req.negocio_id = '11111111-1111-1111-1111-111111111111'
          req.negocio = {
            id: '11111111-1111-1111-1111-111111111111',
            nombre: 'Pruebas-Reservas',
            slug: 'pruebas-reservas',
            activo: true,
            modo_prueba: true,
            monto_sena: 100
          }
          req.rol = decoded.rol || 'colaborador'
          return next()
        }

        if (decoded.negocio_id === '22222222-2222-2222-2222-222222222222' || decoded.slug === 'reservas-futbol') {
          req.user = decoded
          req.negocio_id = '22222222-2222-2222-2222-222222222222'
          req.negocio = {
            id: '22222222-2222-2222-2222-222222222222',
            nombre: 'Reservas Fútbol',
            slug: 'reservas-futbol',
            activo: true,
            modo_prueba: false,
            monto_sena: 100
          }
          req.rol = decoded.rol || 'colaborador'
          return next()
        }

        return res.status(403).json({ error: 'Negocio no encontrado o no existe' })
      }

      if (!negocio.activo) {
        return res.status(403).json({ error: 'El negocio se encuentra suspendido o inactivo' })
      }

      req.user = decoded
      req.negocio_id = negocio.id
      req.negocio = negocio
      req.rol = decoded.rol || 'colaborador'

      next()
    } catch (err) {
      console.error('Error en middleware verifyTenantUser:', err)
      return res.status(500).json({ error: 'Error interno de autenticación' })
    }
  }
}
