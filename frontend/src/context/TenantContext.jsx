import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [negocio, setNegocio] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_business_config')
      return cached ? JSON.parse(cached) : null
    } catch (e) {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`${API_URL}/api/config`)
      if (!res.ok) {
        throw new Error('Error al cargar la configuración del negocio.')
      }

      const data = await res.json()
      setNegocio(data)
      try {
        localStorage.setItem('cached_business_config', JSON.stringify(data))
      } catch (e) {}
    } catch (err) {
      console.warn('Aviso ConfigContext:', err.message)
      setNegocio(prev => {
        if (prev && prev.nombre) return prev
        try {
          const cached = localStorage.getItem('cached_business_config')
          if (cached) return JSON.parse(cached)
        } catch (e) {}
        return {
          id: '22222222-2222-2222-2222-222222222222',
          nombre: 'ChavoF651',
          telefono: '3804201334',
          direccion: 'san martin',
          activo: true,
          modo_prueba: false,
          monto_sena: 100,
          precio_total: 100,
          canchas: [
            { id: '1', nombre: 'Cancha 1', activa: true },
            { id: '2', nombre: 'Cancha 2', activa: true }
          ],
          horarios: [
            '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00'
          ]
        }
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  useEffect(() => {
    if (negocio?.nombre) {
      document.title = `${negocio.nombre} - Reservas de Cancha`
    }
  }, [negocio?.nombre])

  // Actualizar inmediatamente en el estado local de React y en la caché
  const updateLocalConfig = useCallback((newData) => {
    setNegocio(prev => {
      const updated = { ...(prev || {}), ...newData }
      try {
        localStorage.setItem('cached_business_config', JSON.stringify(updated))
      } catch (e) {}
      return updated
    })
  }, [])

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
    slug: '',
    negocio,
    negocioId: negocio?.id || null,
    nombreNegocio: negocio?.nombre || 'ChavoF651',
    telefono: negocio?.telefono || '3804201334',
    direccion: negocio?.direccion || 'san martin',
    montoSena: Number(negocio?.monto_sena) || 100,
    precioTotal: Number(negocio?.precio_total) || 100,
    modoPrueba: !!negocio?.modo_prueba,
    canchas: todasLasCanchas,
    canchasActivas: canchasActivas.length > 0 ? canchasActivas : todasLasCanchas,
    horarios,
    loading,
    error,
    refreshConfig: fetchConfig,
    refreshTenant: fetchConfig,
    updateLocalConfig
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
      slug: '',
      negocio: null,
      negocioId: null,
      nombreNegocio: 'ChavoF651',
      telefono: '3804201334',
      direccion: 'san martin',
      montoSena: 100,
      precioTotal: 100,
      modoPrueba: false,
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
      refreshConfig: () => {},
      refreshTenant: () => {},
      updateLocalConfig: () => {}
    }
  }
  return context
}
