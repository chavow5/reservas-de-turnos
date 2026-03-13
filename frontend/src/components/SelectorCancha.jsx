export default function SelectorCancha({ canchas, selectedCancha, onSelect }) {
  return (
    <div className="mb-4">
      <div className="block text-sm font-medium text-gray-600 mb-1">Cancha</div>
      <div className="flex gap-2">
        {canchas.map(c => {
          const selected = selectedCancha === c
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c)}
              className={`px-3 py-1 rounded border font-medium transition
                ${selected ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}
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
