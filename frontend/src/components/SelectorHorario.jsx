import { ALLOWED_HOURS, isHoraInvalida } from '../utils/dateUtils'

export default function SelectorHorario({ formFecha, formCancha, formHora, reservas, horarios, onSelectHour, allowPastHours = false }) {
  const activeHours = Array.isArray(horarios) && horarios.length > 0 ? horarios : ALLOWED_HOURS
  const primerHorario = activeHours[0] || '15:00'
  const ultimoHorario = activeHours[activeHours.length - 1] || '02:00'

  return (
    <div className="mb-6 sm:mb-8">
      <label className="block text-sm font-semibold text-slate-700 mb-2">Hora (click para seleccionar)</label>
      
      {formFecha ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 mb-2">
          {activeHours.map(h => {
            const isSelected = formHora === h
            const reservaSlot = (reservas || []).find(r => r.fecha === formFecha && r.hora === h && String(r.cancha) === String(formCancha))
            const horaOcupada = Boolean(reservaSlot)
            const enProceso = Boolean(reservaSlot?.en_proceso)
            const horaInvalida = allowPastHours ? false : isHoraInvalida(formFecha, h)

            const disabled = horaOcupada || horaInvalida

            return (
              <button
                key={h}
                type="button"
                onClick={() => onSelectHour(h)}
                disabled={disabled}
                title={enProceso ? 'En proceso de pago por otro usuario (10 min)' : horaOcupada ? 'Horario reservado' : 'Disponible'}
                className={`
                  py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 w-full min-h-[44px] flex items-center justify-center active:scale-95

                  ${horaOcupada && !enProceso ? 'bg-red-500 text-white cursor-not-allowed border border-red-500' : ''}
                  ${horaOcupada && enProceso ? 'bg-amber-500 text-white cursor-not-allowed border border-amber-500 shadow-sm shadow-amber-100' : ''}
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
          <span className="flex items-center gap-1.5" title="Un jugador está abonando este turno. Se libera en 10 min si no completa el pago.">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"></span>
            En pago (10 min)
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
    </div>
  )
}
