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
  const navigate = useNavigate()

  const formatearTurno = (fecha, hora) => {
    const date = new Date(fecha)
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

  const reservasPasadas = reservas.filter(r => r.fecha < hoy && !r.pagado)

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

  const reservasOrdenadas = [...reservasSemana].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)
  )

  return (

    <div className="p-6">

      <div className="flex justify-between mb-6">

        <h1 className="text-2xl font-bold">
          Dashboard Admin
        </h1>

        <button
          onClick={logout}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Cerrar sesión
        </button>

      </div>

      {/* RESUMEN */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

        <div className="bg-white shadow rounded p-4 text-center">
          <p className="text-gray-500">Turnos hoy</p>
          <p className="text-3xl font-bold">{reservasHoy.length}</p>
        </div>

        <div className="bg-white shadow rounded p-4 text-center">
          <p className="text-gray-500">Turnos esta semana</p>
          <p className="text-3xl font-bold">{reservasSemana.length}</p>
        </div>

        <div className="bg-white shadow rounded p-4 text-center">
          <p className="text-gray-500">Total reservas</p>
          <p className="text-3xl font-bold">{reservas.length}</p>
        </div>

      </div>

      {/* BOTONES */}

      <div className="flex gap-3 mb-6">

        <button
          onClick={() => copiar(reservasHoy, 'Turnos de HOY')}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Copiar hoy
        </button>

        <button
          onClick={() => copiar(reservasSemana, 'Turnos de la SEMANA')}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Copiar semana
        </button>

        <button
          onClick={() => setNuevaReserva({ nombre: '', cancha: '1', fecha: hoy, hora: '15:00', pagado: false })}
          className="bg-purple-600 text-white px-4 py-2 rounded ml-auto flex items-center gap-1"
        >
          <span>➕</span> Nueva Reserva Manual
        </button>

      </div>

      {/* FORMULARIO NUEVA RESERVA */}
      {nuevaReserva && (
        <div className="bg-white p-4 shadow-md rounded mb-6 border-l-4 border-purple-600 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600">Nombre</label>
            <input className="border p-2 rounded w-48" placeholder="Nombre jugador" value={nuevaReserva.nombre} onChange={e => setNuevaReserva({ ...nuevaReserva, nombre: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Cancha</label>
            <select className="border p-2 rounded w-20" value={nuevaReserva.cancha} onChange={e => setNuevaReserva({ ...nuevaReserva, cancha: e.target.value })}>
              <option>1</option>
              <option>2</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600">Fecha</label>
            <input type="date" className="border p-2 rounded" value={nuevaReserva.fecha} onChange={e => setNuevaReserva({ ...nuevaReserva, fecha: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Hora</label>
            <select className="border p-2 rounded" value={nuevaReserva.hora} onChange={e => setNuevaReserva({ ...nuevaReserva, hora: e.target.value })}>
              {ALLOWED_HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="flex flex-col items-center justify-center h-[42px]">
            <label className="block text-sm text-gray-600 whitespace-nowrap">Pagado</label>
            <input type="checkbox" className="w-4 h-4 cursor-pointer" checked={nuevaReserva.pagado} onChange={e => setNuevaReserva({ ...nuevaReserva, pagado: e.target.checked })} />
          </div>
          <div className="flex gap-2 ml-auto">
            <button onClick={crearReserva} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Crear</button>
            <button onClick={() => setNuevaReserva(null)} className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Cancelar</button>
          </div>
        </div>
      )}

      {/* TABLA DE RESERVAS */}

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">

          <thead>
            <tr className="bg-gray-200">
              <th>Nombre</th>
              <th>Cancha</th>
              <th>Turno</th>
              <th>Pagado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {reservasOrdenadas.map(r => (

              <tr key={r.id} className="text-center border-t">

                <td>
                  {editando?.id === r.id
                    ? <input
                      value={editando.nombre}
                      onChange={(e) =>
                        setEditando({ ...editando, nombre: e.target.value })
                      }
                    />
                    : r.nombre}
                </td>

                <td>
                  {editando?.id === r.id
                    ? <select
                      value={editando.cancha}
                      onChange={(e) =>
                        setEditando({ ...editando, cancha: e.target.value })
                      }
                    >
                      <option>1</option>
                      <option>2</option>
                    </select>
                    : r.cancha}
                </td>

                <td className="capitalize">
                  {editando?.id === r.id ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={editando.fecha}
                          min={hoy}
                          max={getISODate(new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000))}
                          onChange={(e) =>
                            setEditando({ ...editando, fecha: e.target.value })
                          }
                          className="border px-2 py-1 rounded"
                        />
                        <select
                          value={editando.hora}
                          onChange={(e) =>
                            setEditando({ ...editando, hora: e.target.value })
                          }
                          className="border px-2 py-1 rounded"
                        >
                          {ALLOWED_HOURS.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-sm text-gray-600">
                        {formatearTurno(editando.fecha, editando.hora)}
                      </span>
                    </div>
                  ) : (
                    formatearTurno(r.fecha, r.hora)
                  )}
                </td>

                <td>{r.pagado ? '✔️' : '❌'}</td>

                <td className="flex justify-center gap-2">

                  {editando?.id === r.id ? (

                    <button
                      onClick={guardarEdicion}
                      className="bg-green-500 text-white px-2 py-1 rounded"
                    >
                      Guardar
                    </button>

                  ) : (

                    <button
                      onClick={() => setEditando(r)}
                      className="bg-yellow-500 text-white px-2 py-1 rounded"
                    >
                      Editar
                    </button>

                  )}

                  <button
                    onClick={() => eliminarReserva(r.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Eliminar
                  </button>

                </td>

              </tr>

            ))}
          </tbody>

        </table>
      </div>


      {/* HISTORIAL */}

      <h2 className="text-xl font-bold mt-10 mb-4">
        Historial de reservas
      </h2>

      <table className="w-full border">

        <thead>
          <tr className="bg-gray-200">
            <th>Nombre</th>
            <th>Cancha</th>
            <th>Turno</th>
            <th>Pagado</th>
          </tr>
        </thead>

        <tbody>
          {reservasPasadas.map(r => (

            <tr key={r.id} className="text-center border-t text-gray-500">
              <td className="font-semibold">{r.nombre}</td>
              <td>{r.cancha}</td>
              <td>{formatearTurno(r.fecha, r.hora)}</td>
              <td>{r.pagado ? '✔️' : '❌'}</td>
            </tr>

          ))}
        </tbody>

      </table>

    </div>

  )
}