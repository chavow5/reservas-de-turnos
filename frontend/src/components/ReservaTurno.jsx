import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import axios from 'axios'

const generateAllowedHours = () => {
  const hours = []
  for (let h = 15; h <= 23; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`)
  }
  hours.push('00:00', '01:00')
  return hours
}


const ALLOWED_HOURS = generateAllowedHours()

const todayISO = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const maxWeekISO = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 7)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const isHoraValida = (hora) => {
  const h = Number(hora.split(':')[0])
  return h >= 15 || h < 2
}


const isFechaDentroDeSemana = (fechaIso) => {
  if (!fechaIso) return false
  const selected = new Date(fechaIso)
  selected.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const max = new Date()
  max.setHours(0, 0, 0, 0)
  max.setDate(max.getDate() + 7)
  return selected >= today && selected <= max
}

// Nuevo: genera los 8 días (hoy +7) para mostrar calendario abierto
const getNextWeekDays = () => {
  const days = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i <= 7; i++) {
    const dt = new Date(d)
    dt.setDate(d.getDate() + i)
    const iso = dt.toISOString().slice(0, 10)
    const dayName = dt.toLocaleDateString(undefined, { weekday: 'short' }) // ej: Lun
    const label = dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) // ej: 27 dic
    days.push({ iso, dayName, label })
  }
  return days
}

export default function ReservaTurno() {
  const [reservas, setReservas] = useState([])
  const [form, setForm] = useState({ nombre: '', fecha: '', hora: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase
      .from('reservas')
      .select('*')
      .eq('pagado', true)
      .order('fecha', { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          console.error('Supabase fetch error:', error)
          setReservas([])
        } else {
          setReservas(data || [])
        }
      })
    return () => { mounted = false }
  }, [])

  const days = getNextWeekDays()

  const handleChange = (key) => (e) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  // Selección mediante botones (calendar abierto)
  const selectDay = (iso) => {
    setForm(prev => ({ ...prev, fecha: iso }))
  }

  // Selección de hora mediante botones (click directo)
  const selectHour = (hora) => {
    setForm(prev => ({ ...prev, hora }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.nombre || !form.fecha || !form.hora) {
      return alert('Complete todos los campos')
    }

    if (!isFechaDentroDeSemana(form.fecha)) {
      return alert('Solo puedes reservar hasta 1 semana adelante')
    }

    if (!isHoraValida(form.hora)) {
      return alert('Horarios disponibles solo de 15:00 a 02:00')
    }

    if (reservas.some(r => r.fecha === form.fecha && r.hora === form.hora)) {
      return alert('Horario ocupado')
    }

    try {
      setLoading(true)

      const res = await axios.post('https://reservas-de-turnos.onrender.com/create-preference', {
        nombre: form.nombre,
        fecha: form.fecha,
        hora: form.hora
      })


      window.location.href = res.data.init_point

    } catch (err) {
      console.error('Reserva error:', err)
      alert('Error al iniciar pago')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="max-w-2xl mx-auto mt-10 px-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Reservar turno</h2>

        <label className="block text-sm font-medium text-gray-600 mb-1">Nombre</label>
        <input
          className="block w-full border border-gray-300 rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Tu nombre"
          value={form.nombre}
          onChange={handleChange('nombre')}
          required
        />

        <label className="block text-sm font-medium text-gray-600 mb-2">Fecha (seleccioná con un click)</label>

        {/* Calendario abierto: lista horizontal de días (hoy +7) */}
        <div className="mb-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map(d => {
              const isSelected = form.fecha === d.iso
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => selectDay(d.iso)}
                  aria-pressed={isSelected}
                  className={`min-w-[90px] flex-shrink-0 border rounded p-3 text-center
                    ${isSelected ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}
                    ${isFechaDentroDeSemana(d.iso) ? '' : 'opacity-40 cursor-not-allowed'}`}
                  disabled={!isFechaDentroDeSemana(d.iso)}
                >
                  <div className="text-xs text-gray-300">{d.dayName}</div>
                  <div className="text-sm font-medium mt-1">{d.label}</div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">Puedes reservar hasta {maxWeekISO()}</p>
        </div>

        <label className="block text-sm font-medium text-gray-600 mb-2">Hora (click para seleccionar)</label>

        {/* Hora: botones por hora */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {ALLOWED_HOURS.map(h => {
            const isSelected = form.hora === h
            // si querés deshabilitar horas pasadas del día actual, se puede añadir lógica extra aquí
            return (
              <button
                key={h}
                type="button"
                onClick={() => selectHour(h)}
                className={`py-2 rounded text-sm font-medium
                  ${isSelected ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}
                  border hover:bg-blue-50`}
              >
                {h}
              </button>
            )
          })}
        </div>

        <p className="text-sm text-gray-500 mb-4">Horarios disponibles: 15:00 a 02:00 (seleccionar por hora)</p>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2 rounded"
        >
          {loading ? 'Procesando...' : 'Pagar reserva'}
        </button>
      </form>

      <div className="mt-6 bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium text-gray-800 mb-2">Turnos existentes</h3>
        {reservas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay reservas aún.</p>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-auto">
            {reservas.map(r => (
              <li key={r.id} className="flex items-center justify-between text-sm text-gray-700 p-2 border rounded">
                <div>
                  <div className="font-medium text-gray-800">Reservado</div>
                  <div className="text-xs text-gray-500">{r.fecha} · {r.hora}</div>
                </div>
                <div className="text-xs text-gray-400">ID {r.id}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
