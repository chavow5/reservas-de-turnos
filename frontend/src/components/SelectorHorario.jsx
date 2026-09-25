import { useState } from 'react'
import { ALLOWED_HOURS, isHoraInvalida } from '../utils/dateUtils'

export default function SelectorHorario({ formFecha, formCancha, formHora, reservas, horarios, onSelectHour, allowPastHours = false }) {
  const [avisoHold, setAvisoHold] = useState(null)

  const activeHours = Array.isArray(horarios) && horarios.length > 0 ? horarios : ALLOWED_HOURS
  const primerHorario = activeHours[0] || '15:00'
  const ultimoHorario = activeHours[activeHours.length - 1] || '02:00'

  const handleHourClick = (h, enProceso, disabled) => {
    if (enProceso) {
      setAvisoHold(h)
      return
    }
    if (!disabled) {
      onSelectHour(h)
    }
  }

  return (
    <div className="mb-6 sm:mb-8 relative">
      <label className="block text-sm font-semibold text-slate-700 mb-2">Hora (click para seleccionar)</label>
      
      {formFecha ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 mb-2">
          {activeHours.map(h => {
            const isSelected = formHora === h
            const reservaSlot = (reservas || []).find(r => r.fecha === formFecha && r.hora === h && String(r.cancha) === String(formCancha))
            const horaOcupada = Boolean(reservaSlot)
            const enProceso = Boolean(reservaSlot?.en_proceso)
            const horaInvalida = allowPastHours ? false : isHoraInvalida(formFecha, h)

            // Si está en proceso, NO deshabilitamos el botón para que el usuario pueda hacer click y ver el cartel explicativo
            const disabled = (horaOcupada && !enProceso) || horaInvalida

            return (
              <button
                key={h}
                type="button"
                onClick={() => handleHourClick(h, enProceso, disabled)}
                disabled={disabled}
                title={enProceso ? 'En proceso de pago por otro usuario (click para más info)' : horaOcupada ? 'Horario reservado' : 'Disponible'}
                className={`
                  py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 w-full min-h-[44px] flex items-center justify-center active:scale-95

                  ${horaOcupada && !enProceso ? 'bg-red-500 text-white cursor-not-allowed border border-red-500' : ''}
                  ${enProceso ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer border border-amber-500 shadow-sm shadow-amber-200 animate-pulse' : ''}
                  ${isSelected && !horaOcupada ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 ring-2 ring-blue-400 border border-blue-600 font-black' : ''}
                  ${!horaOcupada && !isSelected && !horaInvalida ? 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:bg-blue-50' : ''}
                  ${horaInvalida && !horaOcupada ? 'opacity-40 cursor-not-allowed bg-slate-50 border border-slate-200 text-slate-400' : ''}
                `}
              >
                {h}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-5 sm:p-6 text-center text-slate-500 text-xs sm:text-sm">
          Primero seleccioná una fecha en el calendario.
        </div>
      )}

      {formFecha && (
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[11px] text-slate-500 mt-2.5 mb-1 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-300 shadow-xs"></span>
            Disponible
          </span>
          <span className="flex items-center gap-1.5" title="Un jugador está abonando este turno. Se libera en 3 min si no completa el pago.">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"></span>
            En reserva (esperar 3 min)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-xs"></span>
            Ocupado
          </span>
        </div>
      )}

      <p className="text-[11px] sm:text-xs text-slate-400 mt-2 text-center">
        Horarios disponibles: {primerHorario} a {ultimoHorario} hs ({activeHours.length} turnos por cancha).
      </p>

      {/* CARTEL MODAL CUANDO EL TURNO ESTÁ EN PROCESO */}
      {avisoHold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-amber-200 text-center relative animate-scale-up">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-black text-slate-800 mb-2">Turno en Proceso de Pago</h3>
            
            <p className="text-slate-600 text-sm mb-4 leading-relaxed">
              El horario de las <strong className="text-slate-900 font-bold">{avisoHold} hs</strong> está siendo reservado y abonado en este momento por otro jugador.
            </p>
            
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-xs text-amber-900 font-medium text-left leading-relaxed">
              ⏳ <strong>Por favor esperá 3 minutos.</strong> Si el otro jugador no completa el pago, el turno se liberará automáticamente y podrás reservarlo. Si no deseas esperar, podés elegir otro horario disponible.
            </div>
            
            <button
              type="button"
              onClick={() => setAvisoHold(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md"
            >
              Entendido, ver otros horarios
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
