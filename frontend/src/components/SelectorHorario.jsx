import { ALLOWED_HOURS, isHoraInvalida } from '../utils/dateUtils'

export default function SelectorHorario({ formFecha, formCancha, formHora, reservas, onSelectHour }) {
  return (
    <div className="mb-8">
      <label className="block text-sm font-semibold text-slate-700 mb-2">Hora (click para seleccionar)</label>
      
      {formFecha ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-2">
          {ALLOWED_HOURS.map(h => {
            const isSelected = formHora === h
            const horaOcupada = reservas.some(r => r.fecha === formFecha && r.hora === h && r.cancha === formCancha)
            const horaInvalida = isHoraInvalida(formFecha, h)

            const disabled = horaOcupada || horaInvalida

            return (
              <button
                key={h}
                type="button"
                onClick={() => onSelectHour(h)}
                disabled={disabled}
                className={`
                  py-3 rounded-xl text-sm font-semibold transition-all duration-200 w-full active:scale-95

                  ${horaOcupada ? 'bg-red-500 text-white cursor-not-allowed border border-red-500' : ''}
                  ${isSelected && !horaOcupada ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-105 border border-blue-600' : ''}
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
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-500 text-sm">
          Primero seleccioná una fecha en el calendario.
        </div>
      )}
      <p className="text-xs text-slate-400 mt-3 text-center">Horarios disponibles: 15:00 a 02:00 hs.</p>
    </div>
  )
}
