import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTenant } from '../context/TenantContext'
import { useAuth } from '../context/AuthContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const ALLOWED_HOURS = [
  ...Array.from({ length: 9 }, (_, i) => `${String(15 + i).padStart(2, '0')}:00`),
  '00:00',
  '01:00'
]

const getISODate = (date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function Dashboard() {
  const { slug, nombreNegocio, refreshTenant } = useTenant()
  const { token, user, isAdmin, isColaborador, logout } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('turnos') // 'turnos' | 'config' | 'colaboradores'
  const [reservas, setReservas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null)
  const [nuevaReserva, setNuevaReserva] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPago, setFilterPago] = useState('todos') // 'todos' | 'pagado' | 'señado' | 'sin_pago'
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Config del Negocio (Admin)
  const [config, setConfig] = useState({
    nombre: nombreNegocio,
    telefono: '',
    direccion: '',
    monto_sena: 100,
    precio_total: 100,
    mp_access_token: '',
    tiene_mp_token: false
  })
  const [configSaved, setConfigSaved] = useState(false)

  // Colaboradores (Admin)
  const [colaboradores, setColaboradores] = useState([])
  const [nuevoColab, setNuevoColab] = useState({ nombre: '', email: '', password: '' })
  const [colabMsg, setColabMsg] = useState('')

  const getAuthHeaders = useCallback(() => {
    const currentToken = token || localStorage.getItem('adminToken')
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`
    }
  }, [token])

  const handleUnauthorized = useCallback(() => {
    logout()
    navigate(`/${slug}/admin`)
  }, [logout, navigate, slug])

  // Cargar reservas
  const fetchReservas = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/admin/reservas`, {
        headers: getAuthHeaders()
      })

      if (res.status === 401 || res.status === 403) {
        handleUnauthorized()
        return
      }

      const data = await res.json()
      const normalized = (data || []).map(r => ({
        ...r,
        cancha: r.cancha ?? '1',
        estado_pago: r.estado_pago || (r.pagado ? 'pagado' : 'sin_pago')
      }))
      setReservas(normalized)
    } catch (err) {
      console.error('Error fetching reservas:', err)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeaders, handleUnauthorized])

  // Cargar Configuración (Solo Admin)
  const fetchConfig = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await fetch(`${API_URL}/admin/config`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (err) {
      console.error('Error fetching config:', err)
    }
  }, [isAdmin, getAuthHeaders])

  // Cargar Colaboradores (Solo Admin)
  const fetchColaboradores = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await fetch(`${API_URL}/admin/colaboradores`, {
        headers: getAuthHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setColaboradores(data || [])
      }
    } catch (err) {
      console.error('Error fetching colaboradores:', err)
    }
  }, [isAdmin, getAuthHeaders])

  useEffect(() => {
    const currentToken = token || localStorage.getItem('adminToken')
    if (!currentToken) {
      navigate(`/${slug}/admin`)
      return
    }
    fetchReservas()
    if (isAdmin) {
      fetchConfig()
      fetchColaboradores()
    }
  }, [token, slug, navigate, isAdmin, fetchReservas, fetchConfig, fetchColaboradores])

  // Formateador de fecha
  const formatearTurno = (fecha, hora) => {
    if (!fecha) return ''
    const [year, month, day] = fecha.split('-')
    const date = new Date(year, month - 1, day)
    const diaTexto = date.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
    const horaTexto = hora?.split(':')[0] || hora
    return `${diaTexto} - ${horaTexto}hs`
  }

  // Cambiar estado de pago rápido desde la tabla
  const cambiarEstadoPago = async (id, nuevoEstado) => {
    const res = await fetch(`${API_URL}/admin/reservas/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        estado_pago: nuevoEstado,
        pagado: ['pagado', 'señado'].includes(nuevoEstado)
      })
    })

    if (res.status === 401) {
      handleUnauthorized()
      return
    }

    if (res.ok) {
      setReservas(prev => prev.map(r => r.id === id ? { ...r, estado_pago: nuevoEstado, pagado: ['pagado', 'señado'].includes(nuevoEstado) } : r))
    }
  }

  // Eliminar reserva
  const eliminarReserva = async (id) => {
    if (!confirm('¿Eliminar esta reserva definitivamente?')) return

    const res = await fetch(`${API_URL}/admin/reservas/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (res.status === 401) {
      handleUnauthorized()
      return
    }

    fetchReservas()
  }

  // Guardar edición completa
  const guardarEdicion = async () => {
    const res = await fetch(`${API_URL}/admin/reservas/${editando.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...editando,
        pagado: ['pagado', 'señado'].includes(editando.estado_pago)
      })
    })

    if (res.status === 401) {
      handleUnauthorized()
      return
    }

    if (!res.ok) {
      const errorData = await res.json()
      alert(`Error al guardar: ${errorData.error || 'Ocurrió un error inesperado'}`)
      return
    }

    setEditando(null)
    fetchReservas()
  }

  // Crear reserva manual
  const crearReserva = async () => {
    if (!nuevaReserva.nombre || !nuevaReserva.fecha || !nuevaReserva.hora) {
      return alert('Completa todos los campos obligatorios')
    }

    const res = await fetch(`${API_URL}/admin/reservas`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(nuevaReserva)
    })

    if (res.status === 401) {
      handleUnauthorized()
      return
    }

    if (!res.ok) {
      const errorData = await res.json()
      alert(`Error al crear: ${errorData.error || 'Ocurrió un error inesperado'}`)
      return
    }

    setNuevaReserva(null)
    fetchReservas()
  }

  // Guardar Configuración
  const guardarConfig = async (e) => {
    e.preventDefault()
    setConfigSaved(false)

    const res = await fetch(`${API_URL}/admin/config`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(config)
    })

    if (res.ok) {
      setConfigSaved(true)
      refreshTenant()
      setTimeout(() => setConfigSaved(false), 3000)
    } else {
      const err = await res.json()
      alert(`Error al guardar configuración: ${err.error}`)
    }
  }

  // Crear Colaborador
  const crearColaborador = async (e) => {
    e.preventDefault()
    setColabMsg('')

    const res = await fetch(`${API_URL}/admin/colaboradores`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(nuevoColab)
    })

    const data = await res.json()

    if (res.ok) {
      setNuevoColab({ nombre: '', email: '', password: '' })
      setColabMsg('✅ Colaborador agregado con éxito')
      fetchColaboradores()
      setTimeout(() => setColabMsg(''), 3000)
    } else {
      alert(`Error: ${data.error}`)
    }
  }

  // Eliminar Colaborador
  const eliminarColaborador = async (id) => {
    if (!confirm('¿Eliminar acceso a este colaborador?')) return

    const res = await fetch(`${API_URL}/admin/colaboradores/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (res.ok) {
      fetchColaboradores()
    } else {
      const data = await res.json()
      alert(`Error: ${data.error}`)
    }
  }

  const hoy = getISODate(new Date())

  const reservasHoy = reservas.filter(r => r.fecha === hoy)
  const reservasSemana = reservas.filter(r => {
    const fecha = new Date(r.fecha)
    const hoyDate = new Date()
    const diff = (fecha - hoyDate) / (1000 * 60 * 60 * 24)
    return diff >= -1 && diff <= 7
  })

  // Filtros de Reservas
  const reservasFiltradas = reservas
    .filter(r => {
      if (filterPago === 'todos') return true
      return r.estado_pago === filterPago
    })
    .filter(r => r.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.hora.localeCompare(b.hora))

  const totalPages = Math.max(1, Math.ceil(reservasFiltradas.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const reservasPaginadas = reservasFiltradas.slice(startIndex, startIndex + itemsPerPage)

  const copiarWhatsApp = (lista, titulo) => {
    let texto = `*${titulo.toUpperCase()} - ${nombreNegocio}*\n\n`
    lista.forEach(r => {
      const estadoTxt = r.estado_pago === 'pagado' ? '[PAGADO]' : r.estado_pago === 'señado' ? '[SEÑADO]' : '[SIN PAGO]'
      texto += `- *Turno:* ${formatearTurno(r.fecha, r.hora)}\n`
      texto += `  - Cancha: ${r.cancha} | Jugador: ${r.nombre}\n`
      texto += `  - Estado: ${estadoTxt}\n\n`
    })
    navigator.clipboard.writeText(texto)
    alert('Lista de turnos copiada para WhatsApp')
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-16">
      
      {/* HEADER DASHBOARD */}
      <header className="bg-white shadow-sm border-b border-slate-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          
          <div className="flex items-center gap-3">
            <Link to={`/${slug}`} className="text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              🏟️ {nombreNegocio}
            </Link>
            
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              isAdmin 
                ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}>
              {isAdmin ? '👑 Administrador' : '👤 Colaborador'}
            </span>
          </div>

          {/* NAVEGACIÓN DE PESTAÑAS */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('turnos')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'turnos'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📅 Turnos
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'config'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ⚙️ Configuración
                </button>
                <button
                  onClick={() => setActiveTab('colaboradores')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === 'colaboradores'
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  👥 Colaboradores
                </button>
              </>
            )}

            <button
              onClick={handleUnauthorized}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold px-4 py-2 rounded-xl text-sm transition-colors ml-2"
            >
              Cerrar sesión
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* ======================================================== */}
        {/* PESTAÑA 1: GESTIÓN DE TURNOS                            */}
        {/* ======================================================== */}
        {activeTab === 'turnos' && (
          <div className="animate-fade-in">
            
            {/* TARJETAS DE MÉTRICAS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Turnos Hoy</p>
                <p className="text-3xl font-extrabold text-slate-800">{reservasHoy.length}</p>
              </div>
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Turnos Esta Semana</p>
                <p className="text-3xl font-extrabold text-slate-800">{reservasSemana.length}</p>
              </div>
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Reservas</p>
                <p className="text-3xl font-extrabold text-slate-800">{reservas.length}</p>
              </div>
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Monto Seña Configurado</p>
                <p className="text-3xl font-extrabold text-emerald-600">${config.monto_sena || 100}</p>
              </div>
            </div>

            {/* ACCIONES, FILTROS Y BUSCADOR */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => copiarWhatsApp(reservasHoy, 'Turnos de HOY')}
                  className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-emerald-200"
                >
                  📋 Copiar Hoy
                </button>
                <button
                  onClick={() => copiarWhatsApp(reservasSemana, 'Turnos de la SEMANA')}
                  className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200"
                >
                  📋 Copiar Semana
                </button>
                <button
                  onClick={() => setNuevaReserva({
                    nombre: '',
                    cancha: '1',
                    fecha: hoy,
                    hora: '15:00',
                    estado_pago: 'señado',
                    monto_pagado: config.monto_sena || 100
                  })}
                  className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-purple-200 flex items-center gap-2"
                >
                  <span>➕</span> Nueva Reserva Manual
                </button>
              </div>

              {/* FILTRO ESTADO DE PAGO Y BUSCADOR */}
              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setFilterPago('todos')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${filterPago === 'todos' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFilterPago('pagado')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${filterPago === 'pagado' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Pagados
                  </button>
                  <button
                    onClick={() => setFilterPago('señado')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${filterPago === 'señado' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Señados
                  </button>
                  <button
                    onClick={() => setFilterPago('sin_pago')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${filterPago === 'sin_pago' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Sin Pago
                  </button>
                </div>

                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    placeholder="Buscar jugador..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
                </div>
              </div>

            </div>

            {/* FORMULARIO NUEVA RESERVA MANUAL */}
            {nuevaReserva && (
              <div className="bg-white p-6 shadow-md rounded-2xl border border-purple-200 mb-8 border-l-4 border-l-purple-600 flex flex-wrap gap-4 items-end animate-fade-in">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Jugador</label>
                  <input
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="Nombre completo"
                    value={nuevaReserva.nombre}
                    onChange={e => setNuevaReserva({ ...nuevaReserva, nombre: e.target.value })}
                  />
                </div>

                <div className="w-28">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cancha</label>
                  <select
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={nuevaReserva.cancha}
                    onChange={e => setNuevaReserva({ ...nuevaReserva, cancha: e.target.value })}
                  >
                    <option value="1">Cancha 1</option>
                    <option value="2">Cancha 2</option>
                  </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                  <input
                    type="date"
                    min={hoy}
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={nuevaReserva.fecha}
                    onChange={e => setNuevaReserva({ ...nuevaReserva, fecha: e.target.value })}
                  />
                </div>

                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora</label>
                  <select
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={nuevaReserva.hora}
                    onChange={e => setNuevaReserva({ ...nuevaReserva, hora: e.target.value })}
                  >
                    {ALLOWED_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estado de Pago</label>
                  <select
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    value={nuevaReserva.estado_pago}
                    onChange={e => setNuevaReserva({ ...nuevaReserva, estado_pago: e.target.value })}
                  >
                    <option value="señado">🟡 Señado</option>
                    <option value="pagado">🟢 Pagado Total</option>
                    <option value="sin_pago">🔴 Sin Pago</option>
                  </select>
                </div>

                <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                  <button
                    onClick={crearReserva}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-emerald-200"
                  >
                    Confirmar Reserva
                  </button>
                  <button
                    onClick={() => setNuevaReserva(null)}
                    className="flex-1 md:flex-none bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* TABLA PRINCIPAL DE RESERVAS */}
            <div className="bg-white shadow-sm border border-slate-100 rounded-3xl overflow-hidden mb-8">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[850px]">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Jugador</th>
                      <th className="px-6 py-4 text-center">Cancha</th>
                      <th className="px-6 py-4">Turno</th>
                      <th className="px-6 py-4 text-center">Estado de Pago</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                          Cargando reservas...
                        </td>
                      </tr>
                    ) : reservasPaginadas.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                          No se encontraron reservas con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      reservasPaginadas.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          
                          {/* NOMBRE */}
                          <td className="px-6 py-4">
                            {editando?.id === r.id ? (
                              <input
                                className="w-full border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={editando.nombre}
                                onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                              />
                            ) : (
                              <span className="font-bold text-slate-800">{r.nombre}</span>
                            )}
                          </td>

                          {/* CANCHA */}
                          <td className="px-6 py-4 text-center">
                            {editando?.id === r.id ? (
                              <select
                                className="border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                value={editando.cancha}
                                onChange={e => setEditando({ ...editando, cancha: e.target.value })}
                              >
                                <option value="1">Cancha 1</option>
                                <option value="2">Cancha 2</option>
                              </select>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                Cancha {r.cancha}
                              </span>
                            )}
                          </td>

                          {/* TURNO */}
                          <td className="px-6 py-4 text-slate-600 capitalize">
                            {editando?.id === r.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  className="border border-slate-300 p-1.5 rounded-lg text-xs"
                                  value={editando.fecha}
                                  onChange={e => setEditando({ ...editando, fecha: e.target.value })}
                                />
                                <select
                                  className="border border-slate-300 p-1.5 rounded-lg text-xs"
                                  value={editando.hora}
                                  onChange={e => setEditando({ ...editando, hora: e.target.value })}
                                >
                                  {ALLOWED_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                              </div>
                            ) : (
                              <span>{formatearTurno(r.fecha, r.hora)}</span>
                            )}
                          </td>

                          {/* ESTADO DE PAGO */}
                          <td className="px-6 py-4 text-center">
                            {editando?.id === r.id ? (
                              <select
                                className="border border-slate-300 p-2 rounded-lg text-xs font-bold"
                                value={editando.estado_pago}
                                onChange={e => setEditando({ ...editando, estado_pago: e.target.value })}
                              >
                                <option value="pagado">🟢 Pagado Total</option>
                                <option value="señado">🟡 Señado</option>
                                <option value="sin_pago">🔴 Sin Pago</option>
                              </select>
                            ) : (
                              <div className="inline-flex items-center">
                                <select
                                  value={r.estado_pago || (r.pagado ? 'pagado' : 'sin_pago')}
                                  onChange={e => cambiarEstadoPago(r.id, e.target.value)}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer outline-none transition-all ${
                                    r.estado_pago === 'pagado'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                      : r.estado_pago === 'señado'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                      : 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                                  }`}
                                >
                                  <option value="pagado">🟢 Pagado</option>
                                  <option value="señado">🟡 Señado</option>
                                  <option value="sin_pago">🔴 Sin Pago</option>
                                </select>
                              </div>
                            )}
                          </td>

                          {/* ACCIONES */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-2">
                              {editando?.id === r.id ? (
                                <>
                                  <button
                                    onClick={guardarEdicion}
                                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditando(null)}
                                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setEditando(r)}
                                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => eliminarReserva(r.id)}
                                    className="bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-slate-600 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  ← Anterior
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  Página <strong className="text-slate-800">{currentPage}</strong> de <strong className="text-slate-800">{totalPages}</strong>
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-slate-600 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Siguiente →
                </button>
              </div>
            )}

          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 2: CONFIGURACIÓN DEL NEGOCIO (SOLO ADMIN)       */}
        {/* ======================================================== */}
        {activeTab === 'config' && isAdmin && (
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100 animate-fade-in">
            
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <span>⚙️</span> Configuración de {nombreNegocio}
            </h2>

            {configSaved && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl mb-6 text-sm font-semibold animate-fade-in">
                ✅ Configuración guardada correctamente.
              </div>
            )}

            <form onSubmit={guardarConfig} className="space-y-6">
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Nombre de la Cancha / Complejo
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium"
                  value={config.nombre || ''}
                  onChange={e => setConfig({ ...config, nombre: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Teléfono / WhatsApp de Contacto
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium"
                    value={config.telefono || ''}
                    onChange={e => setConfig({ ...config, telefono: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Ubicación / Dirección del Complejo
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-medium"
                    value={config.direccion || ''}
                    onChange={e => setConfig({ ...config, direccion: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Monto de la Seña por Reserva ($ ARS)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    min="1"
                    className="w-full border border-slate-200 pl-8 pr-4 py-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-bold"
                    value={config.monto_sena || 100}
                    onChange={e => setConfig({ ...config, monto_sena: e.target.value })}
                    required
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Este es el importe que se le cobrará al cliente por Mercado Pago al reservar.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Access Token de Mercado Pago (Privado)
                </label>
                <input
                  type="password"
                  placeholder={config.tiene_mp_token ? "•••••••••••••••••••• (Ya configurado)" : "APP_USR-..."}
                  className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800 font-mono text-sm"
                  value={config.mp_access_token || ''}
                  onChange={e => setConfig({ ...config, mp_access_token: e.target.value })}
                />
                <p className="text-xs text-slate-400 mt-1.5">
                  {config.tiene_mp_token
                    ? "✅ Tu cuenta de Mercado Pago está vinculada. Si querés cambiarla, ingresá el nuevo token."
                    : "⚠️ No has configurado tu Access Token. Se usará el token general por defecto."}
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl transition-all shadow-sm shadow-blue-200"
              >
                Guardar Cambios
              </button>

            </form>

          </div>
        )}

        {/* ======================================================== */}
        {/* PESTAÑA 3: GESTIÓN DE COLABORADORES (SOLO ADMIN)        */}
        {/* ======================================================== */}
        {activeTab === 'colaboradores' && isAdmin && (
          <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            
            {/* AGREGAR COLABORADOR */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h2 className="text-2xl font-black text-slate-800 mb-2 flex items-center gap-2">
                <span>➕</span> Agregar Nuevo Colaborador
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Los colaboradores pueden ver turnos, crear reservas manuales y cambiar estados de pago, pero no pueden modificar tu configuración ni tus cobros.
              </p>

              {colabMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl mb-6 text-sm font-semibold">
                  {colabMsg}
                </div>
              )}

              <form onSubmit={crearColaborador} className="grid sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre</label>
                  <input
                    type="text"
                    placeholder="ej: Juan Pérez"
                    className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={nuevoColab.nombre}
                    onChange={e => setNuevoColab({ ...nuevoColab, nombre: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Usuario / Email</label>
                  <input
                    type="text"
                    placeholder="ej: juan o juan@cancha.com"
                    className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={nuevoColab.email}
                    onChange={e => setNuevoColab({ ...nuevoColab, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contraseña</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full border border-slate-200 p-2.5 rounded-xl bg-slate-50 focus:bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={nuevoColab.password}
                    onChange={e => setNuevoColab({ ...nuevoColab, password: e.target.value })}
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-purple-200"
                  >
                    Crear Colaborador
                  </button>
                </div>
              </form>
            </div>

            {/* LISTADO DE COLABORADORES */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-800 mb-6">
                Equipo de Trabajo ({colaboradores.length})
              </h3>

              {colaboradores.length === 0 ? (
                <p className="text-slate-400 text-sm italic">
                  Aún no has agregado colaboradores a tu equipo.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {colaboradores.map(c => (
                    <div key={c.id} className="py-4 flex justify-between items-center gap-4">
                      <div>
                        <p className="font-bold text-slate-800">{c.nombre}</p>
                        <p className="text-xs text-slate-500">{c.email} • <span className="capitalize text-purple-600 font-semibold">{c.rol}</span></p>
                      </div>

                      {c.rol !== 'admin' && (
                        <button
                          onClick={() => eliminarColaborador(c.id)}
                          className="text-xs text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg font-semibold transition-colors border border-rose-100"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

    </div>
  )
}