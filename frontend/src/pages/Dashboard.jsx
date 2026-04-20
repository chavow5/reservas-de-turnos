import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

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

// Helper: obtener el JWT y armar el header Authorization
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken')
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
}

export default function Dashboard() {

  const [reservas, setReservas] = useState([])
  const [editando, setEditando] = useState(null)
  const [nuevaReserva, setNuevaReserva] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const navigate = useNavigate()

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const formatearTurno = (fecha, hora) => {
    const [year, month, day] = fecha.split('-')
    const date = new Date(year, month - 1, day)
    const diaTexto = date
      .toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      })
      .replace(',', '')
    const horaTexto = hora?.split(':')[0] || hora
    return `${diaTexto} - ${horaTexto}hs`
  }

  // Si el backend devuelve 401 (token expirado o inválido), mandamos al login
  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem('adminToken')
    navigate('/admin')
  }, [navigate])

  const fetchReservas = useCallback(async () => {
    const res = await fetch(`${API_URL}/admin/reservas`, {
      headers: getAuthHeaders()
    })

    if (res.status === 401) {
      handleUnauthorized()
      return
    }

    const data = await res.json()
    const normalized = (data || []).map(r => ({
      ...r,
      cancha: r.cancha ?? '1'
    }))
    setReservas(normalized)
  }, [handleUnauthorized])

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      navigate('/admin')
      return
    }
    fetchReservas()
  }, [navigate, fetchReservas])

  const eliminarReserva = async (id) => {
    if (!confirm('¿Eliminar reserva?')) return

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

  const guardarEdicion = async () => {
    const res = await fetch(`${API_URL}/admin/reservas/${editando.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(editando)
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

  const logout = () => {
    localStorage.removeItem('adminToken')
    navigate('/')
  }

  const crearReserva = async () => {
    if (!nuevaReserva.nombre || !nuevaReserva.fecha || !nuevaReserva.hora) return alert('Completa todos los campos')

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

  const hoy = getISODate(new Date())

  const reservasHoy = reservas.filter(r => r.fecha === hoy)

  const reservasSemana = reservas.filter(r => {
    const fecha = new Date(r.fecha)
    const hoyDate = new Date()
    const diff = (fecha - hoyDate) / (1000 * 60 * 60 * 24)
    return diff >= -1 && diff <= 7
  })

  const reservasPasadasTodas = reservas
    .filter(r => r.fecha < hoy && !r.pagado)
    .filter(r => r.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora))

  const totalPages = Math.max(1, Math.ceil(reservasPasadasTodas.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const reservasPasadas = reservasPasadasTodas.slice(startIndex, startIndex + itemsPerPage)

  const copiar = (lista, titulo) => {
    let texto = `⚽ ${titulo}\n\n`
    lista.forEach(r => {
      texto += `${formatearTurno(r.fecha, r.hora)}\n`
      texto += `Cancha ${r.cancha}\n`
      texto += `${r.nombre}\n`
      texto += `Pago: ${r.pagado ? 'SI' : 'NO'}\n\n`
    })
    navigator.clipboard.writeText(texto)
    alert('Copiado para WhatsApp')
  }

  const reservasOrdenadas = [...reservasSemana]
    .filter(r => r.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      
      {/* HEADER */}
      <header className="bg-white shadow-sm border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-2xl font-black bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Dashboard Admin
        </h1>
        <button
          onClick={logout}
          className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {/* RESUMEN */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-slate-100 shadow-sm hover:shadow-md rounded-2xl p-5 transition-shadow">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Turnos hoy</p>
            <p className="text-4xl font-extrabold text-slate-800">{reservasHoy.length}</p>
          </div>
          <div className="bg-white border border-slate-100 shadow-sm hover:shadow-md rounded-2xl p-5 transition-shadow">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Turnos esta semana</p>
            <p className="text-4xl font-extrabold text-slate-800">{reservasSemana.length}</p>
          </div>
          <div className="bg-white border border-slate-100 shadow-sm hover:shadow-md rounded-2xl p-5 transition-shadow">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Total reservas</p>
            <p className="text-4xl font-extrabold text-slate-800">{reservas.length}</p>
          </div>
        </div>

        {/* BOTONES Y BUSCADOR */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => copiar(reservasHoy, 'Turnos de HOY')}
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-sm shadow-emerald-200"
            >
              Copiar hoy
            </button>
            <button
              onClick={() => copiar(reservasSemana, 'Turnos de la SEMANA')}
              className="bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-sm shadow-blue-200"
            >
              Copiar semana
            </button>
            <button
              onClick={() => setNuevaReserva({ nombre: '', cancha: '1', fecha: hoy, hora: '15:00', pagado: false })}
              className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-sm shadow-purple-200 flex items-center gap-2"
            >
              <span>➕</span> Nueva Reserva Manual
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* FORMULARIO NUEVA RESERVA */}
        {nuevaReserva && (
          <div className="bg-white p-6 shadow-sm rounded-2xl border border-purple-200 mb-8 border-l-4 border-l-purple-600 flex flex-wrap gap-4 items-end animate-fade-in">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
              <input 
                className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                placeholder="Nombre del jugador" 
                value={nuevaReserva.nombre} 
                onChange={e => setNuevaReserva({ ...nuevaReserva, nombre: e.target.value })} 
              />
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-slate-600 mb-1">Cancha</label>
              <select 
                className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                value={nuevaReserva.cancha} 
                onChange={e => setNuevaReserva({ ...nuevaReserva, cancha: e.target.value })}
              >
                <option>1</option>
                <option>2</option>
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">Fecha</label>
              <input 
                type="date" 
                min={hoy} 
                className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                value={nuevaReserva.fecha} 
                onChange={e => setNuevaReserva({ ...nuevaReserva, fecha: e.target.value })} 
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-medium text-slate-600 mb-1">Hora</label>
              <select 
                className="w-full border border-slate-300 p-2.5 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none" 
                value={nuevaReserva.hora} 
                onChange={e => setNuevaReserva({ ...nuevaReserva, hora: e.target.value })}
              >
                {ALLOWED_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            {/* 
            <div className="flex flex-col items-center justify-center h-[72px] px-2">
              <label className="block text-sm font-medium text-slate-600 mb-2">Pagado</label>
              <input type="checkbox" className="w-5 h-5 cursor-pointer accent-purple-600" checked={nuevaReserva.pagado} onChange={e => setNuevaReserva({ ...nuevaReserva, pagado: e.target.checked })} />
            </div>
            */}
            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
              <button 
                onClick={crearReserva} 
                className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 active:scale-95 text-white font-medium px-6 py-2.5 rounded-xl transition-all shadow-sm shadow-green-200"
              >
                Crear
              </button>
              <button 
                onClick={() => setNuevaReserva(null)} 
                className="flex-1 md:flex-none bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-6 py-2.5 rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* TABLA DE RESERVAS SEMANA */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Próximos Turnos</h2>
        </div>
        
        <div className="bg-white shadow-sm border border-slate-100 rounded-2xl overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
              <thead className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nombre</th>
                  <th className="px-6 py-4 font-semibold">Cancha</th>
                  <th className="px-6 py-4 font-semibold">Turno</th>
                  <th className="px-6 py-4 font-semibold text-center">Pagado</th>
                  <th className="px-6 py-4 font-semibold text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservasOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">No hay reservas próximas que coincidan.</td>
                  </tr>
                ) : reservasOrdenadas.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      {editando?.id === r.id ? (
                        <input
                          className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          value={editando.nombre}
                          onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                        />
                      ) : (
                        <span className="font-medium text-slate-800">{r.nombre}</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {editando?.id === r.id ? (
                        <select
                          className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          value={editando.cancha}
                          onChange={(e) => setEditando({ ...editando, cancha: e.target.value })}
                        >
                          <option>1</option>
                          <option>2</option>
                        </select>
                      ) : (
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                          {r.cancha}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 capitalize text-slate-600">
                      {editando?.id === r.id ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <input
                              type="date"
                              value={editando.fecha}
                              min={hoy}
                              max={getISODate(new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000))}
                              onChange={(e) => setEditando({ ...editando, fecha: e.target.value })}
                              className="border border-slate-300 px-2 py-1.5 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            />
                            <select
                              value={editando.hora}
                              onChange={(e) => setEditando({ ...editando, hora: e.target.value })}
                              className="border border-slate-300 px-2 py-1.5 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            >
                              {ALLOWED_HOURS.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                          <span className="text-xs text-purple-600 font-medium">
                            {formatearTurno(editando.fecha, editando.hora)}
                          </span>
                        </div>
                      ) : (
                        formatearTurno(r.fecha, r.hora)
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-xl">{r.pagado ? '✔️' : '❌'}</span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        {editando?.id === r.id ? (
                          <button
                            onClick={guardarEdicion}
                            className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            Guardar
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditando(r)}
                            className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => eliminarReserva(r.id)}
                          className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* HISTORIAL */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Historial de reservas</h2>
        </div>

        <div className="bg-white shadow-sm border border-slate-100 rounded-2xl overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
              <thead className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Nombre</th>
                  <th className="px-6 py-4 font-semibold text-center">Cancha</th>
                  <th className="px-6 py-4 font-semibold">Turno</th>
                  <th className="px-6 py-4 font-semibold text-center">Pagado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservasPasadas.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-8 text-center text-slate-500 italic">No hay historial para mostrar.</td>
                  </tr>
                ) : reservasPasadas.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors text-slate-600">
                    <td className="px-6 py-4 font-semibold text-slate-800">{r.nombre}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                        {r.cancha}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize">{formatearTurno(r.fecha, r.hora)}</td>
                    <td className="px-6 py-4 text-center text-xl">{r.pagado ? '✔️' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION CONTROLS */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mb-12">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-slate-600 font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              Página <span className="font-bold text-slate-800">{currentPage}</span> de <span className="font-bold text-slate-800">{totalPages}</span>
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-slate-600 font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        )}

      </main>
    </div>
  )
}