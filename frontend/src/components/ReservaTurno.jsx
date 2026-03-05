import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import axios from 'axios'
import { Link } from 'react-router-dom'

const generateAllowedHours = () => {
  const hours = []
  for (let h = 15; h <= 23; h++) {
    hours.push(`${String(h).padStart(2, '0')}:00`)
  }
  hours.push('00:00', '01:00')
  return hours
}
// modificar segun el precio real de la reserva
const PRECIO_RESERVA = 100
const getDiaTexto = (fecha) => {
  if (!fecha) return ''

  const date = new Date(fecha)
  return date.toLocaleDateString('es-AR', { weekday: 'long' })
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

  const [year, month, day] = fechaIso.split('-').map(Number)
  const selected = new Date(year, month - 1, day)
  selected.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const max = new Date()
  max.setHours(0, 0, 0, 0)
  max.setDate(max.getDate() + 7)

  return selected >= today && selected <= max
}
const weekDays = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

// Genera los días del mes para un mes base (por defecto mes actual)
const getCalendarDays = (baseDate = new Date()) => {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const days = []
  const startDay = firstDay.getDay() // 0 = domingo

  // Espacios vacíos antes del día 1
  for (let i = 0; i < startDay; i++) {
    days.push(null)
  }

  // Días reales del mes
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const iso = `${yyyy}-${mm}-${dd}`
    days.push({
      day: d,
      iso
    })
  }

  return days
}

export default function ReservaTurno() {
  const CANCHAS = ['1', '2'] // adicionar más en el futuro

  const [reservas, setReservas] = useState([])
  const [form, setForm] = useState({ nombre: '', cancha: '1', fecha: '', hora: '' })
  const [loading, setLoading] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [texto, setTexto] = useState("Preparando pago...")

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
          // normalizamos por si hay registros antiguos sin campo cancha
          const normalized = (data || []).map(r => ({ ...r, cancha: r.cancha ?? '1' }))
          setReservas(normalized)
        }
      })
    return () => { mounted = false }
  }, [])

  const days = getCalendarDays(currentMonth)

  const goPrevMonth = () => {
    setCurrentMonth(prev => {
      const d = new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
      return d
    })
  }

  const goNextMonth = () => {
    setCurrentMonth(prev => {
      const d = new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
      return d
    })
  }

  const handleChange = (key) => (e) => {
    setForm(prev => {
      const updated = { ...prev, [key]: e.target.value }
      if (key === 'cancha') {
        // al cambiar de cancha descartamos fecha/hora previas
        updated.fecha = ''
        updated.hora = ''
      }
      return updated
    })
  }

  const selectCancha = (c) => {
    setForm(prev => ({ ...prev, cancha: c, fecha: '', hora: '' }))
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

    if (isHoraInvalida(form.fecha, form.hora)) {
      return alert('Debes reservar con al menos 2 horas de anticipación')
    }

    if (reservas.some(r => r.fecha === form.fecha && r.hora === form.hora && r.cancha === form.cancha)) {
      return alert('Horario ocupado')
    }

    try {
      setLoading(true)

      const res = await axios.post('https://reservas-de-turnos.onrender.com/create-preference', {
        nombre: form.nombre,
        cancha: form.cancha,
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

  const buildSelectionDate = (fecha, hora) => {
    const [year, month, day] = fecha.split('-').map(Number)
    const [hh] = hora.split(':')
    const hour = Number(hh)

    const d = new Date(year, month - 1, day, hour, 0, 0, 0)

    return d
  }

  const isHoraInvalida = (fecha, hora) => {
    if (!fecha) return false

    const ahora = new Date()
    const seleccion = buildSelectionDate(fecha, hora)
    const diff = seleccion - ahora

    return diff <= 1 * 60 * 60 * 1000
  }

  const getTiempoRestante = (fecha, hora) => {
    if (!fecha) return null

    const ahora = new Date()
    const seleccion = buildSelectionDate(fecha, hora)

    const diff = seleccion - ahora

    if (diff <= 0) return 'Horario vencido'

    const horas = Math.floor(diff / (1000 * 60 * 60))
    const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    return `Faltan ${horas}h ${minutos}m`
  }
  useEffect(() => {
    if (!loading) return

    const mensajes = [
      "Preparando pago...",
      "Conectando con MercadoPago...",
      "Cargando reserva...",
      "Redirigiendo..."
    ]

    let i = 0

    const intervalo = setInterval(() => {
      i = (i + 1) % mensajes.length
      setTexto(mensajes[i])
    }, 1500)

    return () => clearInterval(intervalo)

  }, [loading])


  return (
    <div className="max-w-2xl mx-auto mt-10 px-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">Reservar turno</h2>

        <label className="block text-sm font-medium text-gray-600 mb-1"> Turno a Nombre de: </label>
        <input
          className="block w-full border border-gray-300 rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Tu nombre completo"
          value={form.nombre}
          onChange={handleChange('nombre')}
          required
        />

        {/* selector de cancha arriba para evitar quiebres en layout */}
        <div className="mb-4">
          <div className="block text-sm font-medium text-gray-600 mb-1">Cancha</div>
          <div className="flex gap-2">
            {CANCHAS.map(c => {
              const selected = form.cancha === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => selectCancha(c)}
                  className={`px-3 py-1 rounded border font-medium transition
                    ${selected ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}
                  `}
                >
                  Cancha {c}
                </button>
              )
            })}
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-600 mb-2">Fecha (seleccioná con un click)</label>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
          {/* Header rojo */}
          <div className="bg-red-600 text-white p-3 flex items-center justify-between">
            <button type="button" onClick={goPrevMonth} className="px-3 py-1 hover:bg-red-500 rounded">◀</button>
            <h2 className="text-xl font-bold text-center flex-1">
              {currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
            </h2>
            <button type="button" onClick={goNextMonth} className="px-3 py-1 hover:bg-red-500 rounded">▶</button>
          </div>

          {/* Días semana */}
          <div className="grid grid-cols-7 text-center bg-gray-100 py-2 text-sm font-semibold">
            {weekDays.map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="text-xs flex justify-center gap-4 py-2">
            <span className="px-2 py-1 bg-green-200 rounded">Disponible</span>
            <span className="px-2 py-1 bg-red-600 text-white rounded">Completo</span>
            <span className="px-2 py-1 bg-blue-600 text-white rounded">Seleccionado</span>
          </div>
          <div className="grid grid-cols-7 text-center">
            {days.map((d, index) => {
              if (!d) return <div key={index} className="p-3"></div>

              const isSelected = form.fecha === d.iso
              const dentroSemana = isFechaDentroDeSemana(d.iso)

              // revisamos si para la cancha seleccionada el día está completamente ocupado
              const reservasDia = reservas.filter(r => r.fecha === d.iso && r.cancha === form.cancha)
              const horasOcupadas = new Set(reservasDia.map(r => r.hora))
              const isFullDay = horasOcupadas.size >= ALLOWED_HOURS.length

              return (
                <button
                  key={d.iso}
                  type="button"
                  disabled={!dentroSemana || isFullDay}
                  onClick={() => selectDay(d.iso)}
                  className={`p-3 border
                    ${isSelected ? 'bg-blue-600 text-blue-500 scale-105' : ''}
                    ${!dentroSemana ? 'opacity-30 cursor-not-allowed' : isFullDay ? 'bg-red-600 text-white' : 'bg-green-200 hover:bg-green-300'}
                  `}
                >
                  {d.day}
                </button>
              )
            })}
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-600 mb-2">Hora (click para seleccionar)</label>

        {/* Hora: botones por hora */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {ALLOWED_HOURS.map(h => {
            const isSelected = form.hora === h
            const horaOcupada = reservas.some(r => r.fecha === form.fecha && r.hora === h && r.cancha === form.cancha)
            const horaInvalida = isHoraInvalida(form.fecha, h)

            const disabled = horaOcupada || horaInvalida

            return (
              <button
                key={h}
                type="button"
                onClick={() => selectHour(h)}
                disabled={disabled}
                className={`
                  py-2 rounded text-sm font-medium border transition w-full

                  ${horaOcupada ? 'bg-red-500 text-white cursor-not-allowed' : ''}
                  ${isSelected && !horaOcupada ? 'bg-blue-600 text-white border-blue-700 shadow scale-105' : ''}
                  ${!horaOcupada && !isSelected ? 'bg-white hover:bg-blue-50' : ''}
                  ${horaInvalida ? 'opacity-30 cursor-not-allowed' : ''}
                `}
              >
                {h}
              </button>
            )
          })}
        </div>

        <p className="text-sm text-gray-500 mb-4">Horarios disponibles: 15:00 a 02:00 (seleccionar por hora)</p>
        {form.fecha && form.hora && (
          <div className="bg-gray-100 border rounded-lg p-4 mb-4 text-sm">

            <p className="text-gray-700 mb-2">
              La reserva se paga al momento de confirmar.
              <span className="font-bold text-black"> Precio: ${PRECIO_RESERVA}</span>
            </p>

            <p className="text-gray-800">
              Reserva para el día <span className="font-semibold capitalize">{getDiaTexto(form.fecha)}</span>
              {' '}a las <span className="font-semibold">{form.hora} hs</span>
              {' '}en <span className="font-semibold">Cancha {form.cancha}</span>.
            </p>

          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded bg-blue-600 text-white"
        >
          {loading ? `${texto} ⏳` : "Pagar reserva"}
        </button>
      </form>


      <div className="mt-6 bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium text-gray-800 mb-2">⚽ ¿Querés armar los equipos rápido?</h3>
        <h1 className="text-lg text-center text-gray-600 mt-4">
          Podés usar nuestro <br />

          <Link
            to="/sorteo"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium my-2"
          >
            Sorteo de equipos
          </Link>

          <br />
          para dividir jugadores al azar.
        </h1>
        {/* {reservas.length === 0 ? (
          <p className="text-sm text-gray-500">No hay reservas aún.</p>
        ) : (
          <ul className="space-y-2 max-h-56 overflow-auto">
            {reservas.map(r => (
              <li key={r.id} className="flex items-center justify-between text-sm text-gray-700 p-2 border rounded">
                <div>
                  <div className="font-medium text-gray-800">Reservado</div>
                  <div className="text-xs text-gray-500">
                    Cancha {r.cancha} – {r.fecha} · {r.hora}
                  </div>
                </div>
                <div className="text-xs text-gray-400">ID {r.id}</div>
              </li>
            ))}
          </ul>
        )} */}
      </div>
    </div>
  )
}