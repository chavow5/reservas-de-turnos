import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { getDiaTexto, isFechaDentroDeSemana, isHoraInvalida } from '../utils/dateUtils'
import SelectorCancha from './SelectorCancha'
import Calendario from './Calendario'
import SelectorHorario from './SelectorHorario'

// modificar segun el precio real de la reserva
const PRECIO_RESERVA = 100

export default function ReservaTurno() {
  const CANCHAS = ['1', '2'] // adicionar más en el futuro

  const [reservas, setReservas] = useState([])
  const [form, setForm] = useState({ nombre: '', cancha: '1', fecha: '', hora: '' })
  const [loading, setLoading] = useState(false)
  const [texto, setTexto] = useState("Preparando pago...")

  useEffect(() => {
    let mounted = true

    // Calculamos el rango: hoy y los próximos 7 días
    // (el calendario no permite reservar más allá de ese límite)
    const hoy = new Date().toISOString().split('T')[0]
    const enSieteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    supabase
      .from('reservas')
      .select('fecha, hora, cancha') // solo los campos necesarios para mostrar horarios ocupados
      .eq('pagado', true)
      .gte('fecha', hoy)
      .lte('fecha', enSieteDias)
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

  const selectDay = (iso) => {
    setForm(prev => ({ ...prev, fecha: iso }))
  }

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

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const res = await axios.post(`${API_URL}/create-preference`, {
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

        <SelectorCancha 
          canchas={CANCHAS} 
          selectedCancha={form.cancha} 
          onSelect={selectCancha} 
        />

        <Calendario 
          formFecha={form.fecha} 
          formCancha={form.cancha} 
          reservas={reservas} 
          onSelectDay={selectDay} 
        />

        <SelectorHorario 
          formFecha={form.fecha} 
          formCancha={form.cancha} 
          formHora={form.hora} 
          reservas={reservas} 
          onSelectHour={selectHour} 
        />

        {form.fecha && form.hora && (
          <div className="bg-gray-100 border rounded-lg p-4 mb-4 text-sm">
            <p className="text-gray-700 mb-2">
              La reserva se paga al momento de confirmar.
              <span className="font-bold text-black"> Precio: ${PRECIO_RESERVA}</span>
            </p>

            <p className="text-gray-800">
              Reserva para el día{' '}
              <span className="font-semibold capitalize">
                {getDiaTexto(form.fecha)} {form.fecha.split('-').reverse().join('/')}
              </span>
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
      </div>
    </div>
  )
}