import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useParams, useLocation } from 'react-router-dom'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const params = useParams()
  const location = useLocation()

  // Extraer el slug del path si no está en params
  const pathParts = location.pathname.split('/').filter(Boolean)
  const slugFromPath = pathParts[0] && !['superadmin', 'sorteo', 'success', 'admin', 'dashboard'].includes(pathParts[0])
    ? pathParts[0]
    : null

  const slug = params.slug || slugFromPath || 'pruebas-reservas'

  const [negocio, setNegocio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTenant = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`${API_URL}/api/negocios/${slug}`)
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`El negocio "${slug}" no existe o no se encuentra registrado.`)
        }
        if (res.status === 403) {
          throw new Error(`El negocio "${slug}" se encuentra temporalmente inactivo.`)
        }
        throw new Error('Error al cargar la información del negocio.')
      }

      const data = await res.json()
      setNegocio(data)
    } catch (err) {
      console.warn('Aviso TenantContext:', err.message)
      // Fallback básico para demo
      if (slug === 'pruebas-reservas') {
        setNegocio({
          id: '11111111-1111-1111-1111-111111111111',
          nombre: 'Pruebas-Reservas',
          slug: 'pruebas-reservas',
          plan: 'pro',
          activo: true,
          modo_prueba: true,
          monto_sena: 100,
          precio_total: 100,
          canchas: [
            { id: '1', nombre: 'Cancha 1', activa: true },
            { id: '2', nombre: 'Cancha 2', activa: true }
          ]
        })
      } else if (slug === 'reservas-futbol') {
        setNegocio({
          id: '22222222-2222-2222-2222-222222222222',
          nombre: 'Reservas Fútbol',
          slug: 'reservas-futbol',
          plan: 'pro',
          activo: true,
          modo_prueba: false,
          monto_sena: 100,
          precio_total: 100,
          canchas: [
            { id: '1', nombre: 'Cancha 1', activa: true },
            { id: '2', nombre: 'Cancha 2', activa: true }
          ]
        })
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchTenant()
  }, [fetchTenant])

  const todasLasCanchas = negocio?.canchas && Array.isArray(negocio.canchas) && negocio.canchas.length > 0
    ? negocio.canchas
    : [
        { id: '1', nombre: 'Cancha 1', activa: true },
        { id: '2', nombre: 'Cancha 2', activa: true }
      ]

  const canchasActivas = todasLasCanchas.filter(c => c.activa !== false)

  const DEFAULT_HORARIOS = [
    '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00'
  ]

  const horarios = negocio?.horarios && Array.isArray(negocio.horarios) && negocio.horarios.length > 0
    ? negocio.horarios
    : DEFAULT_HORARIOS

  const value = {
    slug,
    negocio,
    negocioId: negocio?.id || null,
    nombreNegocio: negocio?.nombre || 'Reservas Fútbol',
    telefono: negocio?.telefono || '5493804201334',
    montoSena: Number(negocio?.monto_sena) || 100,
    modoPrueba: !!negocio?.modo_prueba,
    canchas: todasLasCanchas,
    canchasActivas: canchasActivas.length > 0 ? canchasActivas : todasLasCanchas,
    horarios,
    loading,
    error,
    refreshTenant: fetchTenant
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    return {
      slug: 'pruebas-reservas',
      negocio: null,
      negocioId: null,
      nombreNegocio: 'Reservas Fútbol',
      montoSena: 100,
      modoPrueba: true,
      canchas: [
        { id: '1', nombre: 'Cancha 1', activa: true },
        { id: '2', nombre: 'Cancha 2', activa: true }
      ],
      canchasActivas: [
        { id: '1', nombre: 'Cancha 1', activa: true },
        { id: '2', nombre: 'Cancha 2', activa: true }
      ],
      horarios: [
        '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00'
      ],
      loading: false,
      error: null,
      refreshTenant: () => {}
    }
  }
  return context
}
