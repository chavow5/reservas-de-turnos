import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function SuperAdminDashboard() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('negocios') // 'negocios' | 'cobranzas' | 'reservas' | 'salud'
  const [metricas, setMetricas] = useState({
    totalNegocios: 0,
    negociosActivos: 0,
    totalReservas: 0,
    reservasMes: 0,
    totalRecaudado: 0
  })
  const [negocios, setNegocios] = useState([])
  const [reservasGlobales, setReservasGlobales] = useState([])
  const [historialCobros, setHistorialCobros] = useState([])
  const [filtroNegocioId, setFiltroNegocioId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')

  // Estado de salud en vivo
  const [dbStatus, setDbStatus] = useState(null)
  const [pingingDb, setPingingDb] = useState(false)

  // Modal Nuevo Negocio
  const [showModalNuevo, setShowModalNuevo] = useState(false)
  const [nuevoNegocio, setNuevoNegocio] = useState({
    nombre: '',
    slug: '',
    telefono: '',
    dni: '',
    direccion: '',
    email_contacto: '',
    plan: 'pro',
    modo_prueba: false,
    monto_sena: 100,
    precio_mensual: 25000,
    dia_vencimiento: 10,
    mp_access_token: '',
    admin_nombre: '',
    admin_email: '',
    admin_password: ''
  })
  const [creando, setCreando] = useState(false)
  const [msgModal, setMsgModal] = useState('')

  // Modal Editar Negocio
  const [showModalEditar, setShowModalEditar] = useState(false)
  const [editandoNegocio, setEditandoNegocio] = useState(null)
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [msgEditModal, setMsgEditModal] = useState('')

  // Modal Registrar Cobro Mensualidad
  const [showModalCobro, setShowModalCobro] = useState(false)
  const [cobroData, setCobroData] = useState({
    negocio_id: '',
    negocio_nombre: '',
    mes: '',
    monto: 25000,
    metodo: 'Transferencia Bancaria',
    comprobante: '',
    notas: ''
  })
  const [registrandoCobro, setRegistrandoCobro] = useState(false)
  const [msgCobroModal, setMsgCobroModal] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  const getAuthHeaders = useCallback(() => {
    const currentToken = token || localStorage.getItem('adminToken')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`
    }
  }, [token])

  // Cargar Métricas y Negocios
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true)
      const headers = getAuthHeaders()

      const [resMetricas, resNegocios] = await Promise.all([
        fetch(`${API_URL}/api/superadmin/metricas`, { headers }),
        fetch(`${API_URL}/api/superadmin/negocios`, { headers })
      ])

      if (resMetricas.status === 401 || resMetricas.status === 403) {
        logout()
        navigate('/superadmin')
        return
      }

      if (resMetricas.ok) {
        const m = await resMetricas.json()
        setMetricas(m)
      }

      if (resNegocios.ok) {
        const n = await resNegocios.json()
        setNegocios(n || [])
      }
    } catch (err) {
      console.error('Error cargando datos de SuperAdmin:', err)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, logout, navigate])

  // Cargar Reservas Globales
  const cargarReservasGlobales = useCallback(async () => {
    try {
      const url = filtroNegocioId
        ? `${API_URL}/api/superadmin/reservas?negocio_id=${filtroNegocioId}`
        : `${API_URL}/api/superadmin/reservas`

      const res = await fetch(url, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setReservasGlobales(data || [])
      }
    } catch (err) {
      console.error('Error cargando reservas globales:', err)
    }
  }, [filtroNegocioId, getAuthHeaders])

  // Cargar Historial de Cobros de Mensualidades
  const cargarHistorialCobros = useCallback(async () => {
    try {
      const url = filtroNegocioId
        ? `${API_URL}/api/superadmin/suscripciones/pagos?negocio_id=${filtroNegocioId}`
        : `${API_URL}/api/superadmin/suscripciones/pagos`

      const res = await fetch(url, { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setHistorialCobros(data || [])
      }
    } catch (err) {
      console.error('Error cargando historial de cobros:', err)
    }
  }, [filtroNegocioId, getAuthHeaders])

  // Ping salud
  const testDbHealth = async () => {
    setPingingDb(true)
    try {
      const res = await fetch(`${API_URL}/health/db`)
      const data = await res.json()
      setDbStatus(data)
    } catch (err) {
      setDbStatus({ activa: false, error: err.message, tiempoMs: 0 })
    } finally {
      setPingingDb(false)
    }
  }

  useEffect(() => {
    if (!token && !localStorage.getItem('adminToken')) {
      navigate('/superadmin')
      return
    }
    cargarDatos()
    testDbHealth()
  }, [token, navigate, cargarDatos])

  useEffect(() => {
    if (activeTab === 'reservas') {
      cargarReservasGlobales()
    } else if (activeTab === 'cobranzas') {
      cargarHistorialCobros()
    }
  }, [activeTab, filtroNegocioId, cargarReservasGlobales, cargarHistorialCobros])

  // Autogenerar slug al tipear nombre
  const handleNombreChange = (val) => {
    const autoSlug = val.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')
    setNuevoNegocio(prev => ({
      ...prev,
      nombre: val,
      slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug
    }))
  }

  // Toggle Activo/Suspendido
  const toggleActivo = async (negocio) => {
    const nuevoEstado = !negocio.activo
    const res = await fetch(`${API_URL}/api/superadmin/negocios/${negocio.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ activo: nuevoEstado })
    })

    if (res.ok) {
      setNegocios(prev => prev.map(n => n.id === negocio.id ? { ...n, activo: nuevoEstado } : n))
      showToast(`Negocio ${negocio.nombre} ${nuevoEstado ? 'activado' : 'suspendido'}`)
    } else {
      alert('Error al actualizar estado del negocio')
    }
  }

  // Toggle Modo Demo / Producción en 1 click
  const toggleModoPrueba = async (negocio) => {
    const nuevoModo = !negocio.modo_prueba
    const res = await fetch(`${API_URL}/api/superadmin/negocios/${negocio.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ modo_prueba: nuevoModo })
    })

    if (res.ok) {
      setNegocios(prev => prev.map(n => n.id === negocio.id ? { ...n, modo_prueba: nuevoModo } : n))
      showToast(`"${negocio.nombre}" ahora está en modo ${nuevoModo ? '🚀 DEMO (sin Mercado Pago)' : '💳 PRODUCCIÓN (con Mercado Pago)'}`)
    } else {
      alert('Error al actualizar modo del negocio')
    }
  }

  // Cambiar Estado de Suscripción (Al Día / Pendiente / Vencido)
  const cambiarEstadoSuscripcion = async (negocio, nuevoEstado) => {
    const res = await fetch(`${API_URL}/api/superadmin/negocios/${negocio.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ estado_suscripcion: nuevoEstado })
    })

    if (res.ok) {
      setNegocios(prev => prev.map(n => n.id === negocio.id ? { ...n, estado_suscripcion: nuevoEstado } : n))
      showToast(`Cuota de "${negocio.nombre}" marcada como: ${nuevoEstado === 'al_dia' ? '🟢 Al Día' : nuevoEstado === 'pendiente' ? '🟡 Pendiente' : '🔴 Vencido/Adeuda'}`)
    } else {
      alert('Error al actualizar estado de cuota')
    }
  }

  // Abrir Modal de Registrar Cobro
  const abrirModalCobro = (negocio) => {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const d = new Date()
    const mesSugerido = `${meses[d.getMonth()]} ${d.getFullYear()}`

    setCobroData({
      negocio_id: negocio.id,
      negocio_nombre: negocio.nombre,
      mes: mesSugerido,
      monto: negocio.precio_mensual || 25000,
      metodo: 'Transferencia Bancaria',
      comprobante: '',
      notas: ''
    })
    setMsgCobroModal('')
    setShowModalCobro(true)
  }

  // Guardar Cobro de Mensualidad
  const handleGuardarCobro = async (e) => {
    e.preventDefault()
    setRegistrandoCobro(true)
    setMsgCobroModal('')

    try {
      const res = await fetch(`${API_URL}/api/superadmin/suscripciones/pagar`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(cobroData)
      })

      const data = await res.json()

      if (!res.ok) {
        setMsgCobroModal(`❌ Error: ${data.error}`)
        return
      }

      setMsgCobroModal('🎉 ¡Cobro registrado exitosamente! Cliente al día.')
      setTimeout(() => {
        setShowModalCobro(false)
        setMsgCobroModal('')
        cargarDatos()
        if (activeTab === 'cobranzas') cargarHistorialCobros()
      }, 1200)
    } catch {
      setMsgCobroModal('❌ Error de conexión al registrar cobro')
    } finally {
      setRegistrandoCobro(false)
    }
  }

  // Abrir Modal de Edición
  const abrirEdicion = (negocio) => {
    setEditandoNegocio({
      id: negocio.id,
      nombre: negocio.nombre || '',
      slug: negocio.slug || '',
      telefono: negocio.telefono || '',
      dni: negocio.dni || '',
      direccion: negocio.direccion || '',
      email_contacto: negocio.email_contacto || '',
      monto_sena: negocio.monto_sena || 100,
      precio_mensual: negocio.precio_mensual || 25000,
      dia_vencimiento: negocio.dia_vencimiento || 10,
      estado_suscripcion: negocio.estado_suscripcion || 'al_dia',
      modo_prueba: !!negocio.modo_prueba,
      mp_access_token: negocio.mp_access_token || ''
    })
    setMsgEditModal('')
    setShowModalEditar(true)
  }

  // Guardar Edición de Negocio
  const handleGuardarEdicion = async (e) => {
    e.preventDefault()
    setGuardandoEdit(true)
    setMsgEditModal('')

    try {
      const res = await fetch(`${API_URL}/api/superadmin/negocios/${editandoNegocio.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editandoNegocio)
      })

      const data = await res.json()

      if (!res.ok) {
        setMsgEditModal(`❌ Error: ${data.error}`)
        return
      }

      setMsgEditModal('🎉 ¡Datos del negocio actualizados correctamente!')
      setTimeout(() => {
        setShowModalEditar(false)
        setMsgEditModal('')
        setEditandoNegocio(null)
        cargarDatos()
      }, 1000)
    } catch {
      setMsgEditModal('❌ Error al actualizar el negocio')
    } finally {
      setGuardandoEdit(false)
    }
  }

  // Copiar link al portapapeles
  const copiarLink = (slugPath, tipo) => {
    const fullUrl = `${window.location.origin}/${slugPath}`
    navigator.clipboard.writeText(fullUrl)
    showToast(`📋 Link ${tipo} copiado: ${fullUrl}`)
  }

  // Eliminar negocio
  const eliminarNegocio = async (id, nombre) => {
    if (!confirm(`¿Estás seguro de eliminar el negocio "${nombre}" y todas sus reservas asociadas? Esta acción no se puede deshacer.`)) return

    const res = await fetch(`${API_URL}/api/superadmin/negocios/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (res.ok) {
      showToast(`Negocio ${nombre} eliminado`)
      cargarDatos()
    } else {
      alert('Error al eliminar negocio')
    }
  }

  // Crear Negocio
  const handleCrearNegocio = async (e) => {
    e.preventDefault()
    setCreando(true)
    setMsgModal('')

    try {
      const res = await fetch(`${API_URL}/api/superadmin/negocios`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(nuevoNegocio)
      })

      const data = await res.json()

      if (!res.ok) {
        setMsgModal(`❌ Error: ${data.error}`)
        return
      }

      setMsgModal('🎉 ¡Negocio y cuenta de administrador creados exitosamente!')
      setTimeout(() => {
        setShowModalNuevo(false)
        setMsgModal('')
        setNuevoNegocio({
          nombre: '',
          slug: '',
          telefono: '',
          dni: '',
          direccion: '',
          email_contacto: '',
          plan: 'pro',
          modo_prueba: false,
          monto_sena: 100,
          precio_mensual: 25000,
          dia_vencimiento: 10,
          mp_access_token: '',
          admin_nombre: '',
          admin_email: '',
          admin_password: ''
        })
        cargarDatos()
      }, 1500)
    } catch {
      setMsgModal('❌ Error de conexión al crear negocio')
    } finally {
      setCreando(false)
    }
  }

  const filteredNegocios = negocios.filter(n =>
    n.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.telefono && n.telefono.includes(searchTerm)) ||
    (n.dni && n.dni.includes(searchTerm)) ||
    (n.direccion && n.direccion.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  // Calcular métricas de cobranzas
  const totalCobradoMensualidades = historialCobros.reduce((sum, p) => sum + (Number(p.monto) || 0), 0)
  const totalFacturacionEsperada = negocios.reduce((sum, n) => sum + (Number(n.precio_mensual) || 0), 0)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 relative">
      
      {/* TOAST FLOTANTE */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-2xl animate-fade-in flex items-center gap-2">
          <span>🔔</span> {toastMsg}
        </div>
      )}

      {/* HEADER SUPER ADMIN */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h1 className="text-lg font-black text-white">Super Administrador SaaS</h1>
              <p className="text-xs text-slate-400">Control Maestro de Negocios y Turnos</p>
            </div>
          </div>

          {/* TABS */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('negocios')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'negocios'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🏢 Clientes ({negocios.length})
            </button>

            <button
              onClick={() => setActiveTab('cobranzas')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'cobranzas'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              💳 Cobranzas Mensuales
            </button>

            <button
              onClick={() => setActiveTab('reservas')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'reservas'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              📅 Reservas Globales
            </button>

            <button
              onClick={() => setActiveTab('salud')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'salud'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${dbStatus?.activa ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`}></span>
              Salud DB
            </button>

            <button
              onClick={() => { logout(); navigate('/superadmin'); }}
              className="bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors ml-2"
            >
              Salir
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* TARJETAS DE MÉTRICAS GLOBALES */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Negocios</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{metricas.totalNegocios}</span>
              <span className="text-xs font-semibold text-emerald-400">({metricas.negociosActivos} activos)</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Abonos Mensuales SaaS</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">${totalFacturacionEsperada.toLocaleString('es-AR')}</span>
              <span className="text-xs text-slate-400">/ mes</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Reservas Globales</p>
            <p className="text-3xl font-black text-white">{metricas.totalReservas}</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Señas Procesadas por Canchas</p>
            <p className="text-3xl font-black text-amber-400">${metricas.totalRecaudado?.toLocaleString('es-AR')}</p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: LISTADO DE NEGOCIOS                               */}
        {/* ======================================================== */}
        {activeTab === 'negocios' && (
          <div>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              
              <div className="relative w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono, DNI o ubicación..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-white placeholder-slate-500"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-3 top-3 text-slate-500 text-sm">🔍</span>
              </div>

              <button
                onClick={() => setShowModalNuevo(true)}
                className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
              >
                <span>➕</span> Nuevo Negocio
              </button>

            </div>

            {/* TABLA DE NEGOCIOS */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1150px]">
                  <thead className="bg-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Negocio / Contacto</th>
                      <th className="px-6 py-4">URL / Slug</th>
                      <th className="px-6 py-4 text-center">Abono Mensual</th>
                      <th className="px-6 py-4 text-center">Cuota del Mes</th>
                      <th className="px-6 py-4 text-center">Modo Demo</th>
                      <th className="px-6 py-4 text-center">Mercado Pago</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                          Cargando lista de negocios...
                        </td>
                      </tr>
                    ) : filteredNegocios.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                          No se encontraron negocios con ese filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredNegocios.map(n => (
                        <tr key={n.id} className="hover:bg-slate-800/40 transition-colors">
                          
                          {/* NOMBRE Y DATOS DEL NEGOCIO */}
                          <td className="px-6 py-4">
                            <p className="font-bold text-white text-base">{n.nombre}</p>
                            <div className="flex flex-col gap-0.5 mt-1 text-xs">
                              {n.telefono ? (
                                <span className="text-emerald-400 font-medium">
                                  📞 {n.telefono}
                                </span>
                              ) : null}
                              {n.dni ? (
                                <span className="text-slate-400 font-mono">
                                  🆔 DNI: {n.dni}
                                </span>
                              ) : null}
                              {n.direccion ? (
                                <span className="text-slate-300">
                                  📍 {n.direccion}
                                </span>
                              ) : null}
                              {!n.telefono && !n.dni && !n.direccion && (
                                <span className="text-slate-500 italic">
                                  {n.email_contacto || 'Sin datos de contacto'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* SLUG */}
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs bg-slate-800 text-amber-300 px-2.5 py-1 rounded-lg border border-slate-700">
                              /{n.slug}
                            </span>
                          </td>

                          {/* ABONO MENSUAL */}
                          <td className="px-6 py-4 text-center font-bold text-emerald-400">
                            ${(n.precio_mensual || 25000).toLocaleString('es-AR')}
                            <p className="text-[10px] text-slate-400 font-normal">vence el {n.dia_vencimiento || 10}</p>
                          </td>

                          {/* ESTADO DE CUOTA MENSUAL (AL DÍA / ADEUDA) */}
                          <td className="px-6 py-4 text-center">
                            <select
                              value={n.estado_suscripcion || 'al_dia'}
                              onChange={e => cambiarEstadoSuscripcion(n, e.target.value)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl border focus:outline-none cursor-pointer ${
                                n.estado_suscripcion === 'al_dia'
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                                  : n.estado_suscripcion === 'pendiente'
                                  ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                                  : 'bg-rose-950/80 text-rose-400 border-rose-800'
                              }`}
                            >
                              <option value="al_dia" className="bg-slate-900 text-emerald-400">🟢 Al Día</option>
                              <option value="pendiente" className="bg-slate-900 text-amber-400">🟡 Pendiente</option>
                              <option value="vencido" className="bg-slate-900 text-rose-400">🔴 Adeuda / Vencido</option>
                            </select>
                          </td>

                          {/* MODO TOGGLE DIRECTO */}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleModoPrueba(n)}
                              className={`text-xs font-bold px-3 py-1 rounded-full border transition-all active:scale-95 ${
                                n.modo_prueba
                                  ? 'bg-amber-950/80 text-amber-400 border-amber-800 hover:bg-amber-900'
                                  : 'bg-emerald-950/80 text-emerald-400 border-emerald-800 hover:bg-emerald-900'
                              }`}
                              title="Click para alternar entre Modo Demo y Producción con Mercado Pago"
                            >
                              {n.modo_prueba ? '🚀 Demo' : '💳 Prod'}
                            </button>
                          </td>

                          {/* ESTADO DE CREDENCIAL MP */}
                          <td className="px-6 py-4 text-center">
                            {n.mp_access_token ? (
                              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                                🔑 OK
                              </span>
                            ) : n.slug === 'reservas-futbol' ? (
                              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                                🔑 Principal
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60" title="Sin Token propio">
                                ⚠️ Sin MP
                              </span>
                            )}
                          </td>

                          {/* ESTADO ACTIVO/SUSPENDIDO */}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => toggleActivo(n)}
                              className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                                n.activo
                                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-rose-950 hover:text-rose-400 hover:border-rose-800'
                                  : 'bg-rose-950 text-rose-400 border-rose-800 hover:bg-emerald-950 hover:text-emerald-400 hover:border-emerald-800'
                              }`}
                              title="Click para cambiar estado"
                            >
                              {n.activo ? '🟢 Activo' : '🔴 Suspendido'}
                            </button>
                          </td>

                          {/* ACCIONES Y BOTONES */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center items-center gap-1.5">
                              
                              {/* REGISTRAR COBRO */}
                              <button
                                onClick={() => abrirModalCobro(n)}
                                className="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center gap-1"
                                title="Registrar pago de mensualidad de este cliente"
                              >
                                💵 Cobrar
                              </button>

                              <button
                                onClick={() => copiarLink(n.slug, 'de Reserva')}
                                className="bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all"
                                title="Copiar link de reserva para WhatsApp"
                              >
                                📋 Link
                              </button>

                              <button
                                onClick={() => abrirEdicion(n)}
                                className="bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                                title="Editar datos, precio mensual, DNI, dirección y Mercado Pago"
                              >
                                ✏️
                              </button>

                              <a
                                href={`/${n.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors"
                                title="Ver web de turnos"
                              >
                                🌐
                              </a>

                              <a
                                href={`/${n.slug}/admin`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors"
                                title="Panel de la cancha"
                              >
                                🔐
                              </a>

                              <button
                                onClick={() => eliminarNegocio(n.id, n.nombre)}
                                className="bg-rose-950 hover:bg-rose-900 text-rose-400 text-xs px-2 py-1.5 rounded-lg transition-colors"
                                title="Eliminar cliente"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: HISTORIAL DE COBRANZAS DE MENSUALIDADES           */}
        {/* ======================================================== */}
        {activeTab === 'cobranzas' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-400 uppercase">Filtrar por Cliente:</label>
                <select
                  value={filtroNegocioId}
                  onChange={e => setFiltroNegocioId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">🏢 Todos los Clientes</option>
                  {negocios.map(n => (
                    <option key={n.id} value={n.id}>{n.nombre} (/{n.slug})</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-sm">
                <span className="text-slate-400 font-medium">Total cobrado registrado: </span>
                <strong className="text-emerald-400 font-black">${totalCobradoMensualidades.toLocaleString('es-AR')}</strong>
              </div>

            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[850px]">
                  <thead className="bg-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Cliente / Cancha</th>
                      <th className="px-6 py-4">Mes Abonado</th>
                      <th className="px-6 py-4">Monto Cobrado</th>
                      <th className="px-6 py-4">Fecha de Pago</th>
                      <th className="px-6 py-4">Método / Comprobante</th>
                      <th className="px-6 py-4">Notas</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {historialCobros.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                          Aún no hay cobros de mensualidades registrados.
                        </td>
                      </tr>
                    ) : (
                      historialCobros.map(p => (
                        <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-bold text-white">
                            {p.negocios?.nombre || 'Cliente'}
                            <span className="block text-xs font-normal text-slate-400 font-mono">
                              /{p.negocios?.slug}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-amber-300 font-semibold">{p.mes}</td>
                          <td className="px-6 py-4 font-bold text-emerald-400 font-mono">
                            ${Number(p.monto).toLocaleString('es-AR')}
                          </td>
                          <td className="px-6 py-4 text-slate-300 text-xs">
                            {new Date(p.fecha_pago).toLocaleDateString('es-AR')} {new Date(p.fecha_pago).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <span className="font-semibold text-slate-200">{p.metodo}</span>
                            {p.comprobante && (
                              <span className="block text-slate-400 font-mono">N° {p.comprobante}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400 max-w-xs truncate">
                            {p.notas || '—'}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                              ✅ Pagado
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: EXPLORADOR GLOBAL DE RESERVAS                     */}
        {/* ======================================================== */}
        {activeTab === 'reservas' && (
          <div>
            <div className="flex justify-between items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-400 uppercase">Filtrar por Negocio:</label>
                <select
                  value={filtroNegocioId}
                  onChange={e => setFiltroNegocioId(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">🏢 Todos los Negocios</option>
                  {negocios.map(n => (
                    <option key={n.id} value={n.id}>{n.nombre} (/{n.slug})</option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-slate-400 font-semibold">
                Total reservas encontradas: {reservasGlobales.length}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                  <thead className="bg-slate-800/60 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">Jugador</th>
                      <th className="px-6 py-4">Fecha y Hora</th>
                      <th className="px-6 py-4 text-center">Cancha</th>
                      <th className="px-6 py-4 text-center">Estado Pago</th>
                      <th className="px-6 py-4">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-sm">
                    {reservasGlobales.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                          No hay reservas registradas para este filtro.
                        </td>
                      </tr>
                    ) : (
                      reservasGlobales.map(r => (
                        <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-bold text-white">{r.nombre}</td>
                          <td className="px-6 py-4 text-slate-300">{r.fecha} a las {r.hora} hs</td>
                          <td className="px-6 py-4 text-center">
                            <span className="bg-slate-800 px-2.5 py-1 rounded-full text-xs text-slate-300">
                              Cancha {r.cancha}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              r.estado_pago === 'pagado'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : r.estado_pago === 'señado'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {r.estado_pago === 'pagado' ? '🟢 Pagado' : r.estado_pago === 'señado' ? '🟡 Señado' : '🔴 Sin Pago'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-300 font-mono">
                            ${r.monto_pagado || 0}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: ESTADO Y SALUD DE LA BASE DE DATOS               */}
        {/* ======================================================== */}
        {activeTab === 'salud' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>🩺</span> Diagnóstico de Supabase (Tarea B)
            </h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Monitoreo del estado de actividad de PostgreSQL. Si la base entra en modo reposo (pausada por inactividad),
              el endpoint <code className="bg-slate-800 px-2 py-0.5 rounded text-amber-300">/health/db</code> mide la latencia y la despierta automáticamente antes de que un usuario pague.
            </p>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 mb-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase text-slate-400">Estado de Conexión</span>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  dbStatus?.activa
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {dbStatus?.activa ? '✅ Base de Datos Activa' : '❌ Inactiva o Error'}
                </span>
              </div>

              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-bold uppercase text-slate-400">Tiempo de Respuesta</span>
                <span className="text-sm font-bold text-amber-400 font-mono">
                  {dbStatus?.tiempoMs ? `${dbStatus.tiempoMs} ms` : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-slate-400">Última Verificación</span>
                <span className="text-xs text-slate-400 font-mono">
                  {dbStatus?.timestamp ? new Date(dbStatus.timestamp).toLocaleTimeString() : '—'}
                </span>
              </div>
            </div>

            <button
              onClick={testDbHealth}
              disabled={pingingDb}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              {pingingDb ? 'Comprobando conexión...' : '⚡ Hacer Ping a Supabase'}
            </button>
          </div>
        )}

      </main>

      {/* ======================================================== */}
      {/* MODAL: REGISTRAR COBRO DE MENSUALIDAD                    */}
      {/* ======================================================== */}
      {showModalCobro && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-fade-in text-white">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <span>💵</span> Registrar Cobro de Mensualidad
              </h3>
              <button
                onClick={() => setShowModalCobro(false)}
                className="text-slate-400 hover:text-white text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-300 mb-6 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              Cliente: <strong className="text-amber-300 font-bold text-base">{cobroData.negocio_nombre}</strong>
            </p>

            {msgCobroModal && (
              <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl mb-6 text-sm font-semibold">
                {msgCobroModal}
              </div>
            )}

            <form onSubmit={handleGuardarCobro} className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mes que Abona</label>
                  <input
                    type="text"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-300 font-bold"
                    value={cobroData.mes}
                    onChange={e => setCobroData({ ...cobroData, mes: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Monto Cobrado ($)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-emerald-400 font-black text-lg"
                    value={cobroData.monto}
                    onChange={e => setCobroData({ ...cobroData, monto: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Medio de Pago</label>
                <select
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                  value={cobroData.metodo}
                  onChange={e => setCobroData({ ...cobroData, metodo: e.target.value })}
                >
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Efectivo">Efectivo en Mano</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">N° Comprobante / Referencia (Opcional)</label>
                <input
                  type="text"
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-mono text-sm"
                  value={cobroData.comprobante}
                  onChange={e => setCobroData({ ...cobroData, comprobante: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Notas (Opcional)</label>
                <input
                  type="text"
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white text-sm"
                  value={cobroData.notas}
                  onChange={e => setCobroData({ ...cobroData, notas: e.target.value })}
                />
              </div>

              <button
                type="submit"
                disabled={registrandoCobro}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 mt-4 text-base"
              >
                {registrandoCobro ? 'Guardando cobro...' : 'Confirmar Cobro y Marcar Al Día'}
              </button>

            </form>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ALTA DE NUEVO NEGOCIO (CLIENTE)                   */}
      {/* ======================================================== */}
      {showModalNuevo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl w-full shadow-2xl animate-fade-in text-white max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <span>🏢</span> Alta de Nuevo Negocio
              </h3>
              <button
                onClick={() => setShowModalNuevo(false)}
                className="text-slate-400 hover:text-white text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {msgModal && (
              <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl mb-6 text-sm font-semibold">
                {msgModal}
              </div>
            )}

            <form onSubmit={handleCrearNegocio} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre del Complejo</label>
                <input
                  type="text"
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                  value={nuevoNegocio.nombre}
                  onChange={e => handleNombreChange(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Slug en URL</label>
                  <input
                    type="text"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-300 font-mono text-sm"
                    value={nuevoNegocio.slug}
                    onChange={e => setNuevoNegocio({ ...nuevoNegocio, slug: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Monto Seña Clientes ($)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-bold"
                    value={nuevoNegocio.monto_sena}
                    onChange={e => setNuevoNegocio({ ...nuevoNegocio, monto_sena: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Abono Mensual ($)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-bold"
                    value={nuevoNegocio.precio_mensual}
                    onChange={e => setNuevoNegocio({ ...nuevoNegocio, precio_mensual: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Día de Vencimiento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-bold"
                    value={nuevoNegocio.dia_vencimiento}
                    onChange={e => setNuevoNegocio({ ...nuevoNegocio, dia_vencimiento: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                    value={nuevoNegocio.telefono}
                    onChange={e => setNuevoNegocio({ ...nuevoNegocio, telefono: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">DNI / CUIT</label>
                  <input
                    type="text"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                    value={nuevoNegocio.dni}
                    onChange={e => setNuevoNegocio({ ...nuevoNegocio, dni: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ubicación / Dirección</label>
                <input
                  type="text"
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                  value={nuevoNegocio.direccion}
                  onChange={e => setNuevoNegocio({ ...nuevoNegocio, direccion: e.target.value })}
                />
              </div>

              {/* CREDENCIAL DE MERCADO PAGO */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Access Token de Mercado Pago (Opcional)
                </label>
                <input
                  type="password"
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-mono text-sm"
                  value={nuevoNegocio.mp_access_token}
                  onChange={e => setNuevoNegocio({ ...nuevoNegocio, mp_access_token: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Si se deja vacío y no está en modo demo, el negocio deberá ingresarlo desde su panel admin para cobrar señas.
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="modo_prueba"
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  checked={nuevoNegocio.modo_prueba}
                  onChange={e => setNuevoNegocio({ ...nuevoNegocio, modo_prueba: e.target.checked })}
                />
                <label htmlFor="modo_prueba" className="text-xs text-slate-300 cursor-pointer">
                  <strong>Negocio en Modo Demo / Prueba</strong> (Permite reservas directas sin cobrar en Mercado Pago)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">
                  Administrador Inicial del Negocio
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Usuario / Email</label>
                    <input
                      type="text"
                      className="w-full border border-slate-700 p-2.5 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white text-sm"
                      value={nuevoNegocio.admin_email}
                      onChange={e => setNuevoNegocio({ ...nuevoNegocio, admin_email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Contraseña</label>
                    <input
                      type="password"
                      className="w-full border border-slate-700 p-2.5 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white text-sm"
                      value={nuevoNegocio.admin_password}
                      onChange={e => setNuevoNegocio({ ...nuevoNegocio, admin_password: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={creando}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 mt-4"
              >
                {creando ? 'Creando negocio y admin...' : 'Registrar Negocio y Crear Admin'}
              </button>

            </form>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EDITAR CONFIGURACIÓN Y DATOS DEL NEGOCIO          */}
      {/* ======================================================== */}
      {showModalEditar && editandoNegocio && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-xl w-full shadow-2xl animate-fade-in text-white max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-white flex items-center gap-2">
                <span>✏️</span> Editar Negocio: {editandoNegocio.nombre}
              </h3>
              <button
                onClick={() => { setShowModalEditar(false); setEditandoNegocio(null); }}
                className="text-slate-400 hover:text-white text-2xl font-bold"
              >
                ✕
              </button>
            </div>

            {msgEditModal && (
              <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl mb-6 text-sm font-semibold">
                {msgEditModal}
              </div>
            )}

            <form onSubmit={handleGuardarEdicion} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre del Complejo</label>
                <input
                  type="text"
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                  value={editandoNegocio.nombre}
                  onChange={e => setEditandoNegocio({ ...editandoNegocio, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Slug en URL</label>
                  <input
                    type="text"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-amber-300 font-mono text-sm"
                    value={editandoNegocio.slug}
                    onChange={e => setEditandoNegocio({ ...editandoNegocio, slug: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Monto Seña Clientes ($)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-bold"
                    value={editandoNegocio.monto_sena}
                    onChange={e => setEditandoNegocio({ ...editandoNegocio, monto_sena: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Abono Mensual ($)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-bold"
                    value={editandoNegocio.precio_mensual}
                    onChange={e => setEditandoNegocio({ ...editandoNegocio, precio_mensual: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Día de Vencimiento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-bold"
                    value={editandoNegocio.dia_vencimiento}
                    onChange={e => setEditandoNegocio({ ...editandoNegocio, dia_vencimiento: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                    value={editandoNegocio.telefono || ''}
                    onChange={e => setEditandoNegocio({ ...editandoNegocio, telefono: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">DNI / CUIT</label>
                  <input
                    type="text"
                    className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                    value={editandoNegocio.dni || ''}
                    onChange={e => setEditandoNegocio({ ...editandoNegocio, dni: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Ubicación / Dirección</label>
                <input
                  type="text"
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white"
                  value={editandoNegocio.direccion || ''}
                  onChange={e => setEditandoNegocio({ ...editandoNegocio, direccion: e.target.value })}
                />
              </div>

              {/* CREDENCIAL DE MERCADO PAGO */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                  Access Token de Mercado Pago (Privado)
                </label>
                <input
                  type="password"
                  className="w-full border border-slate-700 p-3 rounded-xl bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-400 text-white font-mono text-sm"
                  value={editandoNegocio.mp_access_token || ''}
                  onChange={e => setEditandoNegocio({ ...editandoNegocio, mp_access_token: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Las señas cobradas a este negocio ingresarán directamente a esta cuenta de Mercado Pago.
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="edit_modo_prueba"
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  checked={editandoNegocio.modo_prueba}
                  onChange={e => setEditandoNegocio({ ...editandoNegocio, modo_prueba: e.target.checked })}
                />
                <label htmlFor="edit_modo_prueba" className="text-xs text-slate-300 cursor-pointer">
                  <strong>Negocio en Modo Demo / Prueba</strong> (Permite reservas directas sin cobrar en Mercado Pago)
                </label>
              </div>

              <button
                type="submit"
                disabled={guardandoEdit}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 mt-4"
              >
                {guardandoEdit ? 'Guardando cambios...' : 'Guardar Cambios'}
              </button>

            </form>

          </div>
        </div>
      )}

    </div>
  )
}
