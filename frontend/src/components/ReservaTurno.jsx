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
  const CANCHAS = ['1', '2']

  const [reservas, setReservas] = useState([])
  const [form, setForm] = useState({ nombre: '', cancha: '1', fecha: '', hora: '' })
  const [loading, setLoading] = useState(false)
  const [texto, setTexto] = useState("Preparando pago...")

  useEffect(() => {
    let mounted = true

    const hoy = new Date().toISOString().split('T')[0]
    const enSieteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    supabase
      .from('reservas')
      .select('fecha, hora, cancha') 
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 pt-8 px-4">
      <div className="max-w-2xl mx-auto">
        
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 mb-8">
          
          <h2 className="text-3xl font-black mb-8 text-gray-800 text-center sm:text-left">
            Reservar Cancha
          </h2>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Turno a Nombre de:
            </label>
            <input
              className="w-full border border-slate-300 rounded-xl px-4 py-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all"
              placeholder="Tu nombre completo"
              value={form.nombre}
              onChange={handleChange('nombre')}
              required
            />
          </div>

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
            <div className="bg-gray-100 border border-gray-200 rounded-2xl p-5 mb-8 text-gray-800 animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">ℹ️</span>
                <div>
                  <p className="font-medium mb-1">
                    La reserva se paga al momento de confirmar.
                  </p>
                  <p className="mb-3 text-gray-700">
                    Monto a pagar: <span className="font-black text-lg bg-white px-2 py-0.5 rounded-lg border border-gray-300 ml-1">${PRECIO_RESERVA}</span>
                  </p>
                  <p className="text-sm opacity-90 border-t border-gray-300 pt-3">
                    Reserva para el día{' '}
                    <span className="font-bold capitalize">
                      {getDiaTexto(form.fecha)} {form.fecha.split('-').reverse().join('/')}
                    </span>
                    {' '}a las <span className="font-bold">{form.hora} hs</span>
                    {' '}en <span className="font-bold">Cancha {form.cancha}</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.nombre || !form.fecha || !form.hora}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none active:scale-95 transition-all text-white font-bold text-lg shadow-sm shadow-blue-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                {texto}
              </span>
            ) : "Pagar reserva"}
          </button>
        </form>

        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 text-center flex flex-col items-center">
          <span className="text-4xl mb-3">⚽</span>
          <h3 className="text-xl font-bold text-slate-800 mb-2">¿Querés armar los equipos rápido?</h3>
          <p className="text-slate-600 mb-5 max-w-sm">
            Podés usar nuestra herramienta gratuita para dividir a los jugadores al azar, sin peleas.
          </p>
          <Link
            to="/sorteo"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm"
          >
            <span>🎲</span> Ir al Sorteo de Equipos
          </Link>
        </div>

      </div>
    </div>
  )
}