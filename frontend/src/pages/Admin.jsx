
import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Admin() {
  const [reservas, setReservas] = useState([])

  useEffect(() => {
    supabase.from('reservas').select('*').then(({ data }) => setReservas(data || []))
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reservas</h1>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th>Nombre</th>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Pagado</th>
          </tr>
        </thead>
        <tbody>
          {reservas.map(r => (
            <tr key={r.id} className="text-center border-t">
              <td>{r.nombre}</td>
              <td>{r.fecha}</td>
              <td>{r.hora}</td>
              <td>{r.pagado ? '✔️' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
