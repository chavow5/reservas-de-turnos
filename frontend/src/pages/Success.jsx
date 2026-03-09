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

  const whatsappText = hasData
    ? `Hola,%20quiero%20confirmar%20mi%20reserva%20*${encodeURIComponent(nombre)}*%20para%20el%20${encodeURIComponent(fecha)}%20a%20las%20${encodeURIComponent(hora)}%20hs%20en%20Cancha%20${encodeURIComponent(cancha)}.`
    : 'Hola,%20quiero%20consultar%20por%20una%20reserva.'

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappText}`

  const copyMessage = () => {
    const message = hasData
      ? `Hola, quiero confirmar mi reserva ${nombre} para el ${fecha} a las ${hora} hs en Cancha ${cancha}.`
      : 'Hola, quiero consultar por una reserva.'

    navigator.clipboard.writeText(message)
    alert('Mensaje copiado, ya podés pegarlo en WhatsApp')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow text-center">
        <h1 className="text-2xl font-semibold text-green-600 mb-2">
          ✅ Turno confirmado
        </h1>

        {hasData ? (
          <div className="text-gray-600 mb-4">
            <p className="mb-2">Reserva confirmada para:</p>
            <p className="font-semibold">{nombre}</p>
            <p>
              {fecha} a las {hora}hs (Cancha {cancha})
            </p>
          </div>
        ) : (
          <p className="text-gray-600 mb-4">El pago fue aprobado correctamente</p>
        )}

        <div className="space-y-3 mb-4">
          <p className="text-sm text-gray-600">
            Envía un mensaje por WhatsApp para enviar el comprobante o coordinar detalles.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            >
              Enviar por WhatsApp
            </a>
            <button
              type="button"
              onClick={copyMessage}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
            >
              Copiar mensaje
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Número: <span className="font-semibold">{whatsappNumber}</span>
          </p>
        </div>

        <div className="mt-6 bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-800 mb-2">⚽ ¿Querés armar los equipos rápido?</h3>
          <h1 className="text-lg text-center text-gray-600 mt-4">
            Podés usar nuestro <br />

            <Link
              to="/sorteo"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium my-2"
            >
              Sorteo de equipos
            </Link>

            <br />
            para dividir jugadores al azar.
          </h1>
        </div>

        <a
          href="/"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Volver
        </a>
      </div>
    </div>
  )
}
