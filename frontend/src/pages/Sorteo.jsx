import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchParams } from "react-router-dom"

export default function Sorteo() {
  const [input, setInput] = useState('')
  const [jugadores, setJugadores] = useState([])
  const [equipoA, setEquipoA] = useState([])
  const [equipoB, setEquipoB] = useState([])

  const [searchParams] = useSearchParams()

  const nombre = searchParams.get("nombre")
  const fecha = searchParams.get("fecha")
  const hora = searchParams.get("hora")
  const cancha = searchParams.get("cancha")

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
⚽ EQUIPO A:
${equipoA.join('\n')}

⚽ EQUIPO B:
${equipoB.join('\n')}
`
    navigator.clipboard.writeText(texto)
    alert('¡Equipos copiados al portapapeles!')
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12 pt-8 px-4">
      <div className="max-w-3xl mx-auto">
        
        {nombre && (
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl mb-8 shadow-sm animate-fade-in text-emerald-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold text-lg">Reserva confirmada</p>
                <p className="opacity-90">Para el <b>{fecha} a las {hora}</b> en <b>Cancha {cancha}</b></p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100">
          
          <h2 className="text-3xl font-black mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Sorteo de Equipos
          </h2>
          
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8 text-slate-700">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span>💡</span> ¿Ya reservaste la cancha?
            </h3>
            <p className="mb-3 leading-relaxed">
              Si ya hiciste la reserva, ahora viene lo importante: 
              <span className="font-semibold text-slate-900"> armar los equipos sin peleas.</span>
            </p>
            <p className="mb-3 leading-relaxed">
              Agregá los nombres de los jugadores y el sistema los divide automáticamente en 
              <span className="font-semibold text-slate-900"> 2 Equipos (A y B)</span> para que lleguen y arranque el picado.
            </p>
            <p className="mb-5 italic opacity-80">
              Nada de perder 10 minutos discutiendo quién juega con quién. 😄
            </p>

            <div className="border-t border-slate-200 pt-5 mt-2">
              <p className="text-slate-600 mb-3 flex items-center gap-2">
                <span>❗</span> <span className="font-medium">¿Todavía no reservaste la cancha?</span>
              </p>
              <Link
                to="/"
                className="inline-block bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm shadow-blue-200"
              >
                Ir a Reservar Cancha
              </Link>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Lista de Jugadores</label>
            <textarea
              rows="8"
              placeholder="Pegá los nombres aquí (uno por línea)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-4 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all resize-y"
            />
          </div>

          <button
            onClick={cargarJugadores}
            disabled={!input.trim()}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-sm shadow-purple-200 mb-8"
          >
            Cargar jugadores
          </button>

          {jugadores.length > 0 && (
            <div className="border-t border-slate-100 pt-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <p className="text-slate-700 text-lg">
                  Total jugadores cargados: <strong className="text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">{jugadores.length}</strong>
                </p>
                <button
                  onClick={hacerSorteo}
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2 text-lg"
                >
                  <span>🎲</span> ¡Hacer Sorteo!
                </button>
              </div>
            </div>
          )}

          {(equipoA.length > 0 || equipoB.length > 0) && (
            <div className="mt-8 animate-fade-in">
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Equipo A */}
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-full -mr-10 -mt-10 opacity-50"></div>
                  <h3 className="font-black text-xl text-blue-800 mb-4 relative z-10 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-blue-500"></span>
                    Equipo A <span className="opacity-60 text-sm font-medium">({equipoA.length})</span>
                  </h3>
                  <ul className="space-y-2 relative z-10">
                    {equipoA.map((j, i) => (
                      <li key={i} className="flex items-center gap-2 text-blue-900 font-medium bg-white/60 p-2 rounded-lg">
                        <span className="text-blue-400 text-sm">{i + 1}.</span> {j}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Equipo B */}
                <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-rose-100 rounded-full -mr-10 -mt-10 opacity-50"></div>
                  <h3 className="font-black text-xl text-rose-800 mb-4 relative z-10 flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-rose-500"></span>
                    Equipo B <span className="opacity-60 text-sm font-medium">({equipoB.length})</span>
                  </h3>
                  <ul className="space-y-2 relative z-10">
                    {equipoB.map((j, i) => (
                      <li key={i} className="flex items-center gap-2 text-rose-900 font-medium bg-white/60 p-2 rounded-lg">
                        <span className="text-rose-400 text-sm">{i + 1}.</span> {j}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-center border-t border-slate-100 pt-6">
                <button
                  onClick={copiarEquipos}
                  className="bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-medium px-8 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
                >
                  <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copiar equipos para WhatsApp
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}