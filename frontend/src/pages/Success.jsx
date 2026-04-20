import { Link, useSearchParams } from "react-router-dom"

export default function Success() {
  const [searchParams] = useSearchParams()

  const nombre = searchParams.get('nombre')
  const fecha = searchParams.get('fecha')
  const hora = searchParams.get('hora')
  const cancha = searchParams.get('cancha')

  const hasData = nombre && fecha && hora && cancha

  // Cambiá este número por el de tu WhatsApp (sin signos, solo código país + número)
  const whatsappNumber = '5493804201334'

  const formattedDate = fecha ? fecha.split('-').reverse().join('/') : ''
  const baseMessage = hasData
    ? `✅ ¡Hola! Paso a confirmar mi reserva:\n\n👤 Nombre: ${nombre}\n📅 Fecha: ${formattedDate}\n⏰ Hora: ${hora} hs\n🏟️ Cancha: ${cancha}`
    : 'Hola, quiero consultar por una reserva.'

  const whatsappText = encodeURIComponent(baseMessage)
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`

  const copyMessage = () => {
    navigator.clipboard.writeText(baseMessage)
    alert('Detalles de la reserva copiados. Ya podés pegarlos en WhatsApp.')
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12 pt-10 px-4">
      <div className="max-w-xl mx-auto animate-fade-in">
        
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center relative overflow-hidden mb-8">
          {/* Círculo decorativo de fondo */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
          
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-4xl shadow-sm shadow-emerald-200">
              ✅
            </div>
          </div>

          <h1 className="text-3xl font-black text-slate-800 mb-2">
            ¡Turno Confirmado!
          </h1>
          
          <p className="text-slate-500 mb-8">
            El pago fue aprobado correctamente y tu reserva está asegurada.
          </p>

          {hasData && (
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-8 text-left shadow-inner">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Detalles de la Reserva</p>
              
              <div className="grid gap-3">
                <div className="flex items-center">
                  <span className="w-10 text-xl">👤</span>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">Jugador</p>
                    <p className="text-slate-800 font-bold text-lg">{nombre}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <span className="w-10 text-xl">📅</span>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">Fecha y Hora</p>
                    <p className="text-slate-800 font-bold">{fecha.split('-').reverse().join('/')} a las {hora}hs</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <span className="w-10 text-xl">🏟️</span>
                  <div>
                    <p className="text-xs text-slate-500 font-semibold">Cancha</p>
                    <p className="text-slate-800 font-bold">Número {cancha}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="font-bold text-slate-700 mb-2">Siguiente Paso</h3>
            <p className="text-sm text-slate-500 mb-4 px-4">
              Envía un mensaje por WhatsApp para que estemos al tanto y coordinemos los detalles.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                WhatsApp
              </a>
              <button
                type="button"
                onClick={copyMessage}
                className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-medium px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                📋 Copiar mensaje
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              O envíanos directamente al <span className="font-bold text-slate-500">+{whatsappNumber}</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 text-center flex flex-col items-center mb-8">
          <span className="text-4xl mb-3">⚽</span>
          <h3 className="text-xl font-bold text-slate-800 mb-2">¿Ya tenés los equipos?</h3>
          <p className="text-slate-600 mb-5 max-w-sm">
            Organizá el partido y dividí a los jugadores al azar en Equipo A y Equipo B, súper rápido.
          </p>
          <Link
            to={`/sorteo?nombre=${encodeURIComponent(nombre)}&fecha=${fecha}&hora=${hora}&cancha=${cancha}`}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-sm shadow-purple-200"
          >
            <span>🎲</span> Ir al Sorteo de Equipos
          </Link>
        </div>

        <div className="text-center">
          <Link
            to="/"
            className="inline-block text-slate-500 hover:text-purple-600 font-medium transition-colors underline underline-offset-4"
          >
            Volver al Inicio
          </Link>
        </div>

      </div>
    </div>
  )
}
