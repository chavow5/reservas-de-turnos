import { useState } from 'react'

export default function Sorteo() {
  const [input, setInput] = useState('')
  const [jugadores, setJugadores] = useState([])
  const [equipoA, setEquipoA] = useState([])
  const [equipoB, setEquipoB] = useState([])

  const cargarJugadores = () => {
    const lista = input
      .split('\n')
      .map(n => n.trim())
      .filter(n => n !== '')

    setJugadores(lista)
    setEquipoA([])
    setEquipoB([])
  }

  const hacerSorteo = () => {
    const mezclados = [...jugadores].sort(() => Math.random() - 0.5)

    const mitad = Math.ceil(mezclados.length / 2)

    setEquipoA(mezclados.slice(0, mitad))
    setEquipoB(mezclados.slice(mitad))
  }

  const copiarEquipos = () => {
    const texto = `
EQUIPO A:
${equipoA.join('\n')}

EQUIPO B:
${equipoB.join('\n')}
`
    navigator.clipboard.writeText(texto)
    alert('Equipos copiados')
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <div className="bg-white p-6 rounded-lg shadow-md">

        <h2 className="text-2xl font-semibold mb-4">⚽ Sorteo de Equipos</h2>
        <div className="bg-white p-5 rounded-lg shadow mb-6 text-sm text-gray-700">
          <p className="font-semibold text-lg mb-2"> ¿Ya reservaste la cancha?</p>

          <p className="mb-2">
            Si ya hiciste la reserva, ahora viene lo importante:
            <span className="font-semibold"> armar los equipos sin peleas.</span>
          </p>

          <p className="mb-2">
            Agregá los nombres de los jugadores y el sistema los divide automáticamente
            en <span className="font-semibold">2 Equipos A y B</span>  para que lleguen y arranque el picado.
          </p>

          <p className="mb-3">
             Nada de perder 10 minutos discutiendo quién juega con quién. 😄
          </p>

          <div className="border-t pt-3">
            <p className="text-gray-600">
              ❗ <span className="font-medium">¿Todavía no reservaste la cancha?</span>
            </p>

            <a
              href="/"
              className="text-blue-600 font-semibold hover:underline"
            >
              Reservá tu turno acá
            </a>
          </div>
        </div>

        <textarea
          rows="8"
          placeholder="Pegá los nombres aquí (uno por línea)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full border rounded p-3 mb-4"
        />

        <button
          onClick={cargarJugadores}
          className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
        >
          Cargar jugadores
        </button>

        {jugadores.length > 0 && (
          <>
            <p className="mb-3 text-gray-700">
              Total jugadores: <strong>{jugadores.length}</strong>
            </p>

            <button
              onClick={hacerSorteo}
              className="bg-green-600 text-white px-4 py-2 rounded mb-6"
            >
              Hacer sorteo
            </button>
          </>
        )}

        {(equipoA.length > 0 || equipoB.length > 0) && (
          <>
            <div className="grid md:grid-cols-2 gap-6">

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-bold text-blue-700 mb-3">
                  🔵 Equipo A ({equipoA.length})
                </h3>
                <ul className="space-y-1 text-sm">
                  {equipoA.map((j, i) => (
                    <li key={i}>{j}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="font-bold text-red-700 mb-3">
                  🔴 Equipo B ({equipoB.length})
                </h3>
                <ul className="space-y-1 text-sm">
                  {equipoB.map((j, i) => (
                    <li key={i}>{j}</li>
                  ))}
                </ul>
              </div>

            </div>

            <button
              onClick={copiarEquipos}
              className="mt-6 bg-gray-800 text-white px-4 py-2 rounded"
            >
              Copiar equipos
            </button>
          </>
        )}

      </div>
    </div>
  )
}