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
    <div className="mb-8">
      <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha (seleccioná con un click)</label>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-4">
        <div className="bg-red-600 text-white p-4 flex items-center justify-between">
          <button type="button" onClick={goPrevMonth} className="p-2 hover:bg-red-500 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-lg font-bold text-center flex-1 capitalize tracking-wide">
            {currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </h2>
          <button type="button" onClick={goNextMonth} className="p-2 hover:bg-red-500 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-7 text-center bg-slate-50 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
          {weekDays.map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="p-2">
          <div className="grid grid-cols-7 gap-1 text-center">
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
                  className={`relative p-3 rounded-xl font-medium text-sm transition-all duration-200
                    ${isSelected 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-105 z-10 font-bold' 
                      : !dentroSemana 
                        ? 'text-slate-300 cursor-not-allowed' 
                        : isFullDay 
                          ? 'bg-red-600 text-white cursor-not-allowed' 
                          : 'bg-green-200 text-green-900 hover:bg-green-300'}
                  `}
                >
                  {d.day}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 text-xs font-medium text-slate-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-200"></div> Disponible
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-600"></div> Completo
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm shadow-blue-200"></div> Seleccionado
        </div>
      </div>
    </div>
  )
}
