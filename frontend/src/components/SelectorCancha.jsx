export default function SelectorCancha({ canchas, selectedCancha, onSelect }) {
  return (
    <div className="mb-6">
      <div className="block text-sm font-semibold text-slate-700 mb-2">Cancha</div>
      <div className="flex gap-3">
        {canchas.map(c => {
          const selected = selectedCancha === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c)}
              className={`px-5 py-2.5 rounded-xl border font-medium transition-all duration-200 active:scale-95 flex-1 sm:flex-none
                ${selected 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
              `}
            >
              Cancha {c}
            </button>
          )
        })}
      </div>
    </div>
  )
}
