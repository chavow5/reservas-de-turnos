import { ALLOWED_HOURS, isHoraInvalida } from '../utils/dateUtils'

export default function SelectorHorario({ formFecha, formCancha, formHora, reservas, onSelectHour }) {
  return (
    <>
      <label className="block text-sm font-medium text-gray-600 mb-2">Hora (click para seleccionar)</label>
      <div className="grid grid-cols-4 gap-2 mb-4">
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
    </>
  )
}
