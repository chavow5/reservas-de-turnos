import { useState } from 'react'
import { getCalendarDays, isFechaDentroDeSemana, weekDays, ALLOWED_HOURS } from '../utils/dateUtils'

export default function Calendario({ formFecha, formCancha, reservas, onSelectDay }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const days = getCalendarDays(currentMonth)

  const goPrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const goNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  return (
    <>
      <label className="block text-sm font-medium text-gray-600 mb-2">Fecha (seleccioná con un click)</label>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
        <div className="bg-red-600 text-white p-3 flex items-center justify-between">
          <button type="button" onClick={goPrevMonth} className="px-3 py-1 hover:bg-red-500 rounded">◀</button>
          <h2 className="text-xl font-bold text-center flex-1">
            {currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </h2>
          <button type="button" onClick={goNextMonth} className="px-3 py-1 hover:bg-red-500 rounded">▶</button>
        </div>

        <div className="grid grid-cols-7 text-center bg-gray-100 py-2 text-sm font-semibold">
          {weekDays.map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="text-xs flex justify-center gap-4 py-2">
          <span className="px-2 py-1 bg-green-200 rounded">Disponible</span>
          <span className="px-2 py-1 bg-red-600 text-white rounded">Completo</span>
          <span className="px-2 py-1 bg-blue-600 text-white rounded">Seleccionado</span>
        </div>
        <div className="grid grid-cols-7 text-center">
          {days.map((d, index) => {
            if (!d) return <div key={index} className="p-3"></div>

            const isSelected = formFecha === d.iso
            const dentroSemana = isFechaDentroDeSemana(d.iso)

            const reservasDia = reservas.filter(r => r.fecha === d.iso && r.cancha === formCancha)
            const horasOcupadas = new Set(reservasDia.map(r => r.hora))
            const isFullDay = horasOcupadas.size >= ALLOWED_HOURS.length

            return (
              <button
                key={d.iso}
                type="button"
                disabled={!dentroSemana || isFullDay}
                onClick={() => onSelectDay(d.iso)}
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
    </>
  )
}
