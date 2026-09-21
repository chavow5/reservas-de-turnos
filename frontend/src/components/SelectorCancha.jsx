export default function SelectorCancha({ canchas = [], selectedCancha, onSelect }) {
  const listaCanchas = (Array.isArray(canchas) ? canchas : [])
    .map(c => {
      if (typeof c === 'string' || typeof c === 'number') {
        const str = String(c)
        const nombre = str.toLowerCase().startsWith('cancha') ? str : `Cancha ${str}`
        return { id: str, nombre, activa: true, precio: null }
      }
      return {
        id: String(c?.id || c?.numero || '1'),
        nombre: c?.nombre || `Cancha ${c?.id || '1'}`,
        activa: c?.activa !== false && c?.disponible !== false,
        precio: c?.precio !== undefined && c?.precio !== null && !isNaN(Number(c.precio)) ? Number(c.precio) : null
      }
    })
    .filter(c => c.activa)

  if (listaCanchas.length === 0) {
    return (
      <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 text-sm font-semibold">
        No hay canchas disponibles para reservar en este momento.
      </div>
    )
  }

  return (
    <div className="mb-6">
      <div className="block text-sm font-semibold text-slate-700 mb-2">Cancha</div>
      <div className="flex flex-wrap gap-2.5">
        {listaCanchas.map(c => {
          const selected = String(selectedCancha) === String(c.id) || String(selectedCancha) === String(c.nombre)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`px-4 py-2.5 rounded-xl border font-semibold text-sm transition-all duration-200 active:scale-95 flex-1 sm:flex-none flex items-center justify-between sm:justify-start gap-2.5
                ${selected 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
              `}
            >
              <span>{c.nombre}</span>
              {c.precio && (
                <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${
                  selected 
                    ? 'bg-blue-700/80 text-white' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  ${c.precio.toLocaleString('es-AR')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
