import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {

  const [reservas, setReservas] = useState([])
  const [editando, setEditando] = useState(null)
  const [filtroFecha, setFiltroFecha] = useState("")
  const navigate = useNavigate()

  const formatearTurno = (fecha, hora) => {

    const date = new Date(fecha)

    const dia = date.toLocaleDateString("es-AR", {
      weekday: "long"
    })

    return `${dia} ${hora}`

  }
  useEffect(() => {

    const isAuth = localStorage.getItem('adminAuth')

    if (!isAuth) {
      navigate('/admin')
      return
    }

    fetchReservas()

  }, [])

  const fetchReservas = async () => {

    const { data } = await supabase
      .from('reservas')
      .select('*')
      .order('fecha', { ascending: true })

    const normalized = (data || []).map(r => ({
      ...r,
      cancha: r.cancha ?? "1"
    }))

    setReservas(normalized)

  }

  const eliminarReserva = async (id) => {

    if (!confirm("Eliminar reserva?")) return

    await supabase.from('reservas').delete().eq('id', id)

    fetchReservas()

  }

  const guardarEdicion = async () => {

    await supabase
      .from('reservas')
      .update(editando)
      .eq('id', editando.id)

    setEditando(null)

    fetchReservas()

  }

  const logout = () => {

    localStorage.removeItem('adminAuth')

    navigate('/')

  }

  const hoy = new Date().toISOString().split("T")[0]

  const reservasHoy = reservas.filter(r => r.fecha === hoy)

  const reservasSemana = reservas.filter(r => {

    const fecha = new Date(r.fecha)

    const hoyDate = new Date()

    const diff = (fecha - hoyDate) / (1000 * 60 * 60 * 24)

    return diff >= -1 && diff <= 7

  })

  const reservasPasadas = reservas.filter(r => r.fecha < hoy)

  const cancha1 = reservasSemana.filter(r => r.cancha === "1").length
  const cancha2 = reservasSemana.filter(r => r.cancha === "2").length

  const copiar = (lista, titulo) => {

    let texto = `⚽ ${titulo}\n\n`

    lista.forEach(r => {

      texto += `${formatearTurno(r.fecha, r.hora)}\n`
      texto += `Cancha ${r.cancha}\n`
      texto += `${r.nombre}\n`
      texto += `Pago: ${r.pagado ? "SI" : "NO"}\n\n`

    })

    navigator.clipboard.writeText(texto)

    alert("Copiado para WhatsApp")

  }

  const reservasFiltradas = filtroFecha
    ? reservas.filter(r => r.fecha === filtroFecha)
    : reservasSemana.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))

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
          <p className="text-gray-500">Cancha 1</p>
          <p className="text-3xl font-bold">{cancha1}</p>
        </div>

        <div className="bg-white shadow rounded p-4 text-center">
          <p className="text-gray-500">Cancha 2</p>
          <p className="text-3xl font-bold">{cancha2}</p>
        </div>

        <div className="bg-white shadow rounded p-4 text-center">
          <p className="text-gray-500">Total reservas</p>
          <p className="text-3xl font-bold">{reservas.length}</p>
        </div>

      </div>

      {/* BOTONES */}

      <div className="flex gap-3 mb-6">

        <button
          onClick={() => copiar(reservasHoy, "Turnos de HOY")}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Copiar hoy
        </button>

        <button
          onClick={() => copiar(reservasSemana, "Turnos de la SEMANA")}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Copiar semana
        </button>

      </div>

      {/* FILTRO */}

      <div className="mb-4">

        <input
          type="date"
          value={filtroFecha}
          onChange={(e) => setFiltroFecha(e.target.value)}
          className="border p-2 rounded"
        />

      </div>

      {/* TABLA SEMANA / FILTRADA */}

      <div className="overflow-x-auto">
        <table className="w-full border text-sm">

          <thead>

            <tr className="bg-gray-200">

              <th>Nombre</th>
              <th>Cancha</th>
              <th>turno</th>
              <th>Pagado</th>
              <th>Acciones</th>

            </tr>

          </thead>

          <tbody>

            {reservasFiltradas.map(r => (

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
                  {formatearTurno(r.fecha, r.hora)}
                </td>

                <td>
                  {editando?.id === r.id
                    ? <input
                      value={editando.hora}
                      onChange={(e) =>
                        setEditando({ ...editando, hora: e.target.value })
                      }
                    />
                    : r.hora}
                </td>

                <td>{r.pagado ? "✔️" : "❌"}</td>

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
                <td>{r.fecha}</td>
                <td>{r.hora}</td>
                <td>{r.pagado ? "✔️" : "❌"}</td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      )
}