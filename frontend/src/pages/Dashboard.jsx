import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const [reservas, setReservas] = useState([])
  const navigate = useNavigate()

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

    // normalizar para versiones anteriores que no tenían cancha
    const normalized = (data || []).map(r => ({ ...r, cancha: r.cancha ?? '1' }))
    setReservas(normalized)
  }

  const eliminarReserva = async (id) => {
    await supabase.from('reservas').delete().eq('id', id)
    fetchReservas()
  }

  const logout = () => {
    localStorage.removeItem('adminAuth')
    navigate('/')
  }

  return (
    <div className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">Dashboard Admin</h1>
        <button onClick={logout} className="bg-red-500 text-white px-3 py-1 rounded">
          Cerrar sesión
        </button>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th>Nombre</th>
            <th>Cancha</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Pagado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map(r => (
            <tr key={r.id} className="text-center border-t">
              <td>{r.nombre}</td>
              <td>{r.cancha}</td>
              <td>{r.fecha}</td>
              <td>{r.hora}</td>
              <td>{r.pagado ? '✔️' : '❌'}</td>
              <td>
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
  )
}