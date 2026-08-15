import { useEffect, useState, useCallback } from 'react'
import axios from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { getDiaTexto, isFechaDentroDeSemana, isHoraInvalida } from '../utils/dateUtils'
import { useTenant } from '../context/TenantContext'
import SelectorCancha from './SelectorCancha'
import Calendario from './Calendario'
import SelectorHorario from './SelectorHorario'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ReservaTurno() {
  const { slug, nombreNegocio, montoSena, modoPrueba, canchasActivas = [], horarios = [], error: tenantError, loading: tenantLoading } = useTenant()
  const navigate = useNavigate()

  const [reservas, setReservas] = useState([])
  const [form, setForm] = useState({
    nombre: '',
    cancha: canchasActivas[0]?.id || '1',
    fecha: '',
    hora: ''
  })
  const [loading, setLoading] = useState(false)
  const [texto, setTexto] = useState("Preparando pago...")
  const [dbError, setDbError] = useState(null)
  const [dbChecking, setDbChecking] = useState(false)

  // Asegurar que si cambian las canchas activas, la cancha seleccionada sea válida
  useEffect(() => {
    if (canchasActivas.length > 0) {
      const existe = canchasActivas.some(c => String(c.id) === String(form.cancha))
      if (!existe) {
        setForm(prev => ({ ...prev, cancha: canchasActivas[0].id, fecha: '', hora: '' }))
      }
    }
  }, [canchasActivas, form.cancha])

  // Cargar turnos ocupados para el negocio actual
  const fetchTurnosOcupados = useCallback(async () => {
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const enSieteDias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      const res = await axios.get(`${API_URL}/api/negocios/${slug}/turnos-ocupados`, {
        params: { desde: hoy, hasta: enSieteDias }
      })

      const normalized = (res.data || []).map(r => ({
        ...r,
        cancha: r.cancha ?? '1'
      }))
      setReservas(normalized)
    } catch (err) {
      console.warn('Error cargando turnos ocupados:', err.message)
      setReservas([])
    }
  }, [slug])

  useEffect(() => {
    fetchTurnosOcupados()
  }, [fetchTurnosOcupados])

  const handleChange = (key) => (e) => {
    setDbError(null)
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
    setDbError(null)
    setForm(prev => ({ ...prev, cancha: c, fecha: '', hora: '' }))
  }

  const selectDay = (iso) => {
    setDbError(null)
    setForm(prev => ({ ...prev, fecha: iso }))
  }

  const selectHour = (hora) => {
    setDbError(null)
    setForm(prev => ({ ...prev, hora }))
  }

  // ============================
  // TAREA B: CHEQUEO DE BASE ACTIVA ANTES DE RESERVAR / PAGAR
  // ============================
  const verificarBaseActiva = async () => {
    setDbChecking(true)
    try {
      const res = await axios.get(`${API_URL}/health/db`, { timeout: 6000 })
      if (res.data && res.data.activa === true) {
        return true
      }
      return false
    } catch (err) {
      console.warn('⚠️ Base de datos no respondió o inactiva:', err.message)
      return false
    } finally {
      setDbChecking(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setDbError(null)

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
      return alert('Horario ocupado. Por favor seleccione otro turno.')
    }

    try {
      setLoading(true)
      setTexto("Verificando estado del servidor...")

      // 🛡️ TAREA B: Chequear si la base de datos está activa
      const estaActiva = await verificarBaseActiva()

      if (!estaActiva) {
        // Bloquear el paso a pago bajo cualquier circunstancia
        setLoading(false)
        setDbError("No pudimos conectar con la base de datos (puede estar iniciándose). Por favor probá de nuevo en unos segundos.")
        return
      }

      // CASO 1: MODO PRUEBA (Confirmación directa sin Mercado Pago)
      if (modoPrueba) {
        setTexto("Confirmando reserva de prueba...")
        const res = await axios.post(`${API_URL}/api/demo/reservar`, {
          slug,
          nombre: form.nombre,
          cancha: form.cancha,
          fecha: form.fecha,
          hora: form.hora
        })

        if (res.data.ok) {
          navigate(`/${slug}/success?nombre=${encodeURIComponent(form.nombre)}&fecha=${form.fecha}&hora=${form.hora}&cancha=${form.cancha}&demo=true`)
          return
        }
      }

      // CASO 2: PRODUCCIÓN (Mercado Pago dinámico)
      setTexto("Conectando con Mercado Pago...")
      
      // Abrir pestaña emergente de forma anticipada para evitar bloqueos del navegador
      let popupWindow = null
      try {
        popupWindow = window.open('about:blank', '_blank')
      } catch (popupErr) {
        console.warn('No se pudo pre-abrir la pestaña:', popupErr)
      }

      try {
        const res = await axios.post(`${API_URL}/create-preference`, {
          slug,
          nombre: form.nombre,
          cancha: form.cancha,
          fecha: form.fecha,
          hora: form.hora
        })

        if (res.data && res.data.init_point) {
          const initPoint = res.data.init_point

          // Asignar el enlace de Mercado Pago a la pestaña abierta
          if (popupWindow && !popupWindow.closed) {
            popupWindow.location.href = initPoint
          } else {
            window.open(initPoint, '_blank')
          }

          // Redirigir la pestaña actual a la confirmación de la reserva
          navigate(`/${slug}/success?nombre=${encodeURIComponent(form.nombre)}&fecha=${form.fecha}&hora=${form.hora}&cancha=${form.cancha}&mp_url=${encodeURIComponent(initPoint)}`)
          return
        } else {
          if (popupWindow && !popupWindow.closed) popupWindow.close()
          throw new Error('No se pudo obtener el punto de inicio de pago')
        }
      } catch (mpErr) {
        if (popupWindow && !popupWindow.closed) popupWindow.close()
        throw mpErr
      }

    } catch (err) {
      console.error('Error al procesar reserva:', err)
      const backendError = err.response?.data?.message || err.response?.data?.error || err.message
      setDbError(`Error al procesar reserva: ${backendError}`)
    } finally {
      setLoading(false)
    }
  }

  // Animación de textos durante la carga
  useEffect(() => {
    if (!loading) return

    const mensajes = modoPrueba
      ? ["Verificando turno...", "Guardando reserva de prueba...", "Cargando confirmación..."]
      : ["Preparando pago...", "Conectando con MercadoPago...", "Cargando reserva...", "Redirigiendo..."]

    let i = 0
    const intervalo = setInterval(() => {
      i = (i + 1) % mensajes.length
      setTexto(mensajes[i])
    }, 1500)

    return () => clearInterval(intervalo)
  }, [loading, modoPrueba])

  if (tenantLoading) {
    return (
      <div className="flex justify-center items-center h-96 text-slate-500 font-medium">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        Cargando datos de la cancha...
      </div>
    )
  }

  if (tenantError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-md text-center">
          <span className="text-5xl mb-4 block">🏟️</span>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Negocio no encontrado</h2>
          <p className="text-slate-600 mb-6">{tenantError}</p>
          <Link
            to="/pruebas-reservas"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl shadow-sm transition-all"
          >
            Ir a Negocio de Prueba
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 pt-4 sm:pt-8 px-3 sm:px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* BANNER MODO DEMO / PRUEBAS */}
        {modoPrueba && (
          <div className="bg-amber-50 border border-amber-200 p-4 sm:p-5 rounded-2xl mb-4 sm:mb-6 text-amber-900 shadow-sm flex items-start gap-3">
            <span className="text-xl sm:text-2xl mt-0.5">🚀</span>
            <div>
              <p className="font-bold text-sm sm:text-base">Modo Demostración Activo</p>
              <p className="text-xs sm:text-sm opacity-90 mt-0.5">
                Esta es una vista previa de prueba para clientes. Podés reservar turnos directamente 
                <strong> sin pasar por Mercado Pago</strong>.
              </p>
            </div>
          </div>
        )}

        {/* ALERTA DE ERROR DE BASE DE DATOS */}
        {dbError && (
          <div className="bg-rose-50 border border-rose-200 p-4 sm:p-5 rounded-2xl mb-4 sm:mb-6 text-rose-900 shadow-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <span className="text-xl sm:text-2xl">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-sm sm:text-base mb-1">Problema de conexión</p>
                <p className="text-xs sm:text-sm opacity-95 mb-3">{dbError}</p>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={dbChecking || loading}
                  className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-rose-200 flex items-center gap-2"
                >
                  {dbChecking ? 'Reintentando conexión...' : '🔄 Reintentar ahora'}
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 mb-6 sm:mb-8">
          
          <h2 className="text-2xl sm:text-3xl font-black mb-6 sm:mb-8 text-gray-800 text-center sm:text-left">
            Reservar Cancha en {nombreNegocio}
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
            canchas={canchasActivas} 
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
            horarios={horarios}
            onSelectHour={selectHour} 
          />

          {form.fecha && form.hora && (
            <div className="bg-gray-100 border border-gray-200 rounded-2xl p-5 mb-8 text-gray-800 animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">ℹ️</span>
                <div>
                  <p className="font-medium mb-1">
                    {modoPrueba ? 'Reserva de prueba (sin costo real).' : 'La seña se abona al momento de confirmar.'}
                  </p>
                  <p className="mb-3 text-gray-700">
                    Monto de la seña: <span className="font-black text-lg bg-white px-2 py-0.5 rounded-lg border border-gray-300 ml-1">${montoSena}</span>
                  </p>
                  <p className="text-sm opacity-90 border-t border-gray-300 pt-3">
                    Reserva para el día{' '}
                    <span className="font-bold capitalize">
                      {getDiaTexto(form.fecha)} {form.fecha.split('-').reverse().join('/')}
                    </span>
                    {' '}a las <span className="font-bold">{form.hora} hs</span>
                    {' '}en <span className="font-bold">{canchasActivas.find(c => String(c.id) === String(form.cancha))?.nombre || `Cancha ${form.cancha}`}</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.nombre || !form.fecha || !form.hora}
            className={`w-full py-3.5 rounded-xl text-white font-bold text-lg shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none ${
              modoPrueba
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {texto}
              </span>
            ) : modoPrueba ? (
              "Confirmar Turno (Modo Prueba)"
            ) : (
              "Pagar seña de reserva"
            )}
          </button>
        </form>

        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 text-center flex flex-col items-center">
          <span className="text-4xl mb-3">⚽</span>
          <h3 className="text-xl font-bold text-slate-800 mb-2">¿Querés armar los equipos rápido?</h3>
          <p className="text-slate-600 mb-5 max-w-sm">
            Podés usar nuestra herramienta gratuita para dividir a los jugadores al azar, sin peleas.
          </p>
          <Link
            to={`/${slug}/sorteo`}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm"
          >
            <span>🎲</span> Ir al Sorteo de Equipos
          </Link>
        </div>

      </div>
    </div>
  )
}